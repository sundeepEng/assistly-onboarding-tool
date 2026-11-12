import { PayoutDAL } from './../../../dal/payout.dal';
import { z } from 'zod';
import {
  CreatePaymentRequestSchema,
  CreatePaymentSchema,
} from '../../../models/Payments/payment.model';
import { FormatResponse } from '../../../utils/response-formatter';
import { UsersDAL } from '../../../dal/users.dal';
import { PaymentDAL } from '../../../dal/payment.dal';
import { InvoiceDAL } from '../../../dal/invoice.dal';
import { v4 as uuidv4 } from 'uuid';
import { getStripeClient } from '../../../utils/stripe';
import { updatePayoutHandler } from '../payout/update-payout';

const usersDAL = new UsersDAL();
const paymentDAL = new PaymentDAL();
const payoutDAL = new PayoutDAL();
const invoiceDAL = new InvoiceDAL();

const makeIdempotencyKey = (params: {
  subject_type: 'INVOICE' | 'PAYROLL_PAYOUT';
  subject_id: number;
  provider: 'STRIPE' | 'MANUAL';
  amount_cents: number;
}) => {
  return `pay-${params.subject_type}-${params.subject_id}-${params.provider}-${params.amount_cents}`;
};

const assertStripePayeeReady = async (payee_user_id: string) => {
  const payee = await usersDAL.fetchUserById(payee_user_id);

  if (!payee || Object.keys(payee)?.length === 0) {
    return { ok: false as const, message: `Payee user not found: ${payee_user_id}` };
  }

  if (!payee.stripeAccountId) {
    return { ok: false as const, message: `Payee is not connected to Stripe` };
  }

  if (!payee.stripeChargesEnabled || !payee.stripePayoutsEnabled) {
    return { ok: false as const, message: `Payee Stripe onboarding not completed` };
  }

  return { ok: true as const, stripeAccountId: payee.stripeAccountId as string };
};

const FRONTEND_URL =
  process.env.STAGE! === 'main'
    ? 'https://www.assistly.live'
    : `https://${process.env.STAGE!}.assistly.live`;

export const createPaymentHandler = async (
  paymentData: z.infer<typeof CreatePaymentRequestSchema>
) => {
  const stripe = await getStripeClient();

  if (!paymentData) {
    return FormatResponse(404, {
      message: 'Failed to create payment',
      error: 'No data provided',
    });
  }

  try {
    //validate request payload
    const newPaymentReq = CreatePaymentRequestSchema.parse(paymentData);

    console.info(
      `{api: '/create-payment', message: 'Validated data', data: ${JSON.stringify(paymentData)}}`
    );

    //Validate payer exists
    if (Object.keys(await usersDAL.fetchUserById(paymentData.payer_user_id))?.length === 0) {
      return FormatResponse(404, {
        message: 'Failed to create payment',
        error: `Payer not found with userID - ${paymentData.payer_user_id}`,
      });
    }

    //  Resolve subject from DB + derive payee + amount
    let subject_id_numeric: number;
    let payee_user_id: string;
    let amount_cents: number;
    let subjectLabelForStripe: string;

    if (newPaymentReq.subject_type === 'PAYROLL_PAYOUT') {
      const payoutDetails = await payoutDAL.getAllPayouts({
        payroll_payout_id: newPaymentReq.subject_public_id,
      } as any);
      const payout = payoutDetails?.[0];

      if (!payout) {
        return FormatResponse(404, {
          message: 'Failed to create payment',
          error: `Payout not found for payroll_payout_id - ${newPaymentReq.subject_public_id}`,
        });
      }

      if (payout.status === 'PAID') {
        return FormatResponse(409, {
          message: 'Failed to create payment',
          error: 'Payout already paid',
        });
      }
      subject_id_numeric = payout.id as number;
      payee_user_id = payout.pcg_user_id;
      amount_cents = payout.total_amount_cents;
      subjectLabelForStripe = `Payout ${payout.payroll_payout_id}`;
    } else {
      const invoiceDetails = await invoiceDAL.getAllInvoices({
        invoice_id: newPaymentReq.subject_public_id,
      } as any);
      const invoice = invoiceDetails?.[0];

      if (!invoice.created_by_user_id) {
        return FormatResponse(409, {
          message: 'Failed to create payment',
          error: 'Invoice schema missing pcho_user_id (payee). Add pcho_user_id to invoice table.',
        });
      }

      if (!invoice) {
        return FormatResponse(404, {
          message: 'Failed to create payment',
          error: `Invoice not found for invoice_id - ${newPaymentReq.subject_public_id}`,
        });
      }

      if (invoice.status === 'PAID') {
        return FormatResponse(409, {
          message: 'Failed to create payment',
          error: 'Invoice already paid',
        });
      }

      subject_id_numeric = invoice.id as number;
      payee_user_id = invoice.created_by_user_id as string;

      // If invoice stores dollars, convert; if invoice stores cents, prefer cents.
      amount_cents = Math.round(Number(invoice.total_amount) * 100);

      subjectLabelForStripe = `Invoice ${invoice.invoice_id}`;
    }

    // Validate payee exists
    if (Object.keys(await usersDAL.fetchUserById(payee_user_id))?.length === 0) {
      return FormatResponse(404, {
        message: 'Failed to create payment',
        error: `Payee not found with userID - ${payee_user_id}`,
      });
    }

    // Create idempotency key + check duplicates
    const idempotency_key = makeIdempotencyKey({
      subject_type: newPaymentReq.subject_type,
      subject_id: subject_id_numeric,
      provider: newPaymentReq.provider,
      amount_cents,
    });

    const existing = await paymentDAL.getPaymentByIdempotencyKey(idempotency_key);
    if (existing) {
      return FormatResponse(409, {
        message: 'Failed to create payment',
        error: 'Payment already exists for this request',
      });
    }

    // Manual payment path
    // -------------------------------------------------
    if (newPaymentReq.provider === 'MANUAL') {
      if (!newPaymentReq.manual_method) {
        return FormatResponse(404, {
          message: 'Failed to create payment',
          error: 'manual_method is required for manual payments',
        });
      }

      const paymentRow: z.infer<typeof CreatePaymentSchema> = {
        payment_id: uuidv4(),
        subject_type: newPaymentReq.subject_type,
        subject_id: subject_id_numeric,
        payer_user_id: newPaymentReq.payer_user_id,
        payee_user_id: payee_user_id,
        provider: 'MANUAL',
        status: newPaymentReq.subject_type === 'PAYROLL_PAYOUT' ? 'PAID' : 'PENDING_APPROVAL',
        currency: 'usd',
        amount_cents: amount_cents,

        stripe_connected_account_id: null,
        stripe_checkout_session_id: null,
        stripe_payment_intent_id: null,
        stripe_charge_id: null,
        stripe_refund_id: null,
        stripe_payment_status: null,
        stripe_session_status: null,

        manual_method: newPaymentReq.manual_method,
        manual_reference: newPaymentReq.manual_reference ?? null,
        manual_notes: newPaymentReq.manual_notes ?? null,
        manual_paid_at: newPaymentReq.manual_paid_at ?? new Date().toISOString(),

        idempotency_key: idempotency_key,
        created_by_user_id: newPaymentReq.initiated_by_user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      CreatePaymentSchema.parse(paymentRow);
      await paymentDAL.createPayment(paymentRow);

      if (newPaymentReq.subject_type === 'PAYROLL_PAYOUT') {
        const payouts = await payoutDAL.getAllPayouts({
          payroll_payout_id: newPaymentReq.subject_public_id,
        } as any);
        const payout = payouts?.[0];

        if (payout) {
          const payoutUpdateResp: any = await updatePayoutHandler(payout.id as number, {
            ...payout,
            status: 'PAID',
            updated_at: new Date().toISOString(),
          });

          if (payoutUpdateResp?.statusCode && payoutUpdateResp.statusCode >= 300) {
            return payoutUpdateResp;
          }
        }
      }

      return FormatResponse(201, {
        message: 'Manual payment recorded successfully',
        payment: paymentRow,
      });
    }

    //Stripe Hosted Checkout path
    // -------------------------------------------------

    const payeeReady = await assertStripePayeeReady(payee_user_id);
    if (!payeeReady.ok) {
      return FormatResponse(409, {
        message: 'Failed to create Stripe payment',
        error: payeeReady.message,
      });
    }

    // Create payment row first
    const payment_id = uuidv4();

    const paymentRow: z.infer<typeof CreatePaymentSchema> = {
      payment_id: payment_id,
      subject_type: newPaymentReq.subject_type,
      subject_id: subject_id_numeric,
      payer_user_id: newPaymentReq.payer_user_id,
      payee_user_id: payee_user_id,
      provider: 'STRIPE',
      status: 'PENDING',
      currency: 'usd',
      amount_cents: amount_cents,

      stripe_connected_account_id: payeeReady.stripeAccountId,
      stripe_checkout_session_id: null,
      stripe_payment_intent_id: null,
      stripe_charge_id: null,
      stripe_refund_id: null,
      stripe_payment_status: null,
      stripe_session_status: null,

      manual_method: null,
      manual_reference: null,
      manual_notes: null,
      manual_paid_at: null,

      idempotency_key: idempotency_key,
      created_by_user_id: newPaymentReq.initiated_by_user_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    CreatePaymentSchema.parse(paymentRow);
    await paymentDAL.createPayment(paymentRow);

    // Create Checkout session on PAYEE connected account (direct)
    const successUrl = newPaymentReq.success_url ?? `${FRONTEND_URL}`;
    const cancelUrl = newPaymentReq.cancel_url ?? `${FRONTEND_URL}`;
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_intent_data: {
          metadata: {
            payment_id: payment_id,
            subject_type: newPaymentReq.subject_type,
            subject_id: String(subject_id_numeric), // internal numeric
            subject_public_id: newPaymentReq.subject_public_id, // public string
            payer_user_id: newPaymentReq.payer_user_id,
            environment: process.env.STAGE!,
          },
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: amount_cents,
              product_data: {
                name:
                  newPaymentReq.subject_type === 'INVOICE' ? 'Invoice Payment' : 'Payroll Payment',
                description: subjectLabelForStripe,
              },
            },
          },
        ],
        metadata: {
          payment_id,
          subject_type: newPaymentReq.subject_type,
          subject_id: String(subject_id_numeric),
          subject_public_id: newPaymentReq.subject_public_id,
          environment: process.env.STAGE ?? 'unknown',
        },
      },
      {
        stripeAccount: payeeReady.stripeAccountId,
        idempotencyKey: idempotency_key,
      }
    );

    await paymentDAL.updatePaymentByPaymentId(payment_id, {
      stripe_checkout_session_id: session.id,
      stripe_session_status: session.status ?? null,
      stripe_payment_status: (session as any).payment_status ?? null,
    });

    return FormatResponse(201, {
      message: 'Stripe checkout session created successfully',
      payment_id,
      session_id: session.id,
      checkout_url: session.url,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: err.errors,
      });
    }
    return FormatResponse(500, {
      message: 'Failed to create payment',
      error: (err as Error).message,
    });
  }
};
