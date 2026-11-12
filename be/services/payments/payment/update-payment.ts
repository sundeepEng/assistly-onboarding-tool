import { z } from 'zod';
import { UpdatePaymentSchema } from '../../../models/Payments/payment.model';
import { PaymentDAL } from '../../../dal/payment.dal';
import { FormatResponse } from '../../../utils/response-formatter';
import { InvoiceDAL } from '../../../dal/invoice.dal';
import { PayoutDAL } from '../../../dal/payout.dal';
import { updateInvoiceHandler } from '../invoice/update-invoice';
import { updatePayoutHandler } from '../payout/update-payout';

const paymentDAL = new PaymentDAL();
const invoiceDAL = new InvoiceDAL();
const payoutDAL = new PayoutDAL();

export const updatePaymentHandler = async (
  id: any,
  updatePaymentReq: z.infer<typeof UpdatePaymentSchema>
) => {
  if (!id || !updatePaymentReq) {
    console.error(`{api: '/update-payment', error: No body provided}`);
    return FormatResponse(404, {
      message: 'Failed to update payment',
      error: 'id and body are required',
    });
  }

  id = Number(id);

  try {
    if (updatePaymentReq.id && updatePaymentReq.id !== id) {
      return FormatResponse(409, {
        message: 'Failed to update payment',
        error: 'Payment ID mismatch - id in the body does not match with the path parameter',
      });
    }

    const existingPayment = await paymentDAL.getAllPayments({ id });

    if (!existingPayment || existingPayment.length === 0) {
      return FormatResponse(404, {
        message: 'Failed to update payment',
        error: `Payment with id ${id} not found`,
      });
    }

    const existing = existingPayment?.[0] as z.infer<typeof UpdatePaymentSchema>;

    console.info('Ezisting Payment: ', existing);

    // only MANUAL payments are editable
    if (existing.provider !== 'MANUAL') {
      return FormatResponse(409, {
        message: 'Failed to update payment',
        error: 'Only MANUAL payments can be updated/approved',
      });
    }

    // Only allow status transition to PAID or PENDING_APPROVAL
    const requestedStatus = updatePaymentReq.status;

    const allowedStatuses = ['PAID', 'PENDING_APPROVAL'];

    if (!allowedStatuses.includes(requestedStatus)) {
      return FormatResponse(400, {
        message: 'Failed to update payment',
        error: 'Manual payments can only be updated to status PAID or PENDING_APPROVAL',
      });
    }

    // Idempotent: if already PAID, return OK
    if (existing.status === 'PAID') {
      return FormatResponse(200, {
        message: 'Payment already approved',
        payment: existing,
      });
    }

    const updatedPaymentData = {
      ...existing,
      status: 'PAID',
      updated_at: new Date().toISOString(),
    };

    console.log('Updated Payment Data: ', updatedPaymentData);

    const validatedPayment = UpdatePaymentSchema.parse(updatedPaymentData);

    const { id: validatedId, ...updateData } = validatedPayment;

    const updatedPayment = await paymentDAL.updatePaymentById(id, updateData);

    if (requestedStatus === 'PAID') {
      if (existing.subject_type === 'INVOICE') {
        // You still need to fetch the invoice to know invoice.id + existing fields,
        // unless your updateInvoiceHandler supports partial patch by invoice_id/public id.
        const invoices = await invoiceDAL.getAllInvoices({ id: existing.subject_id } as any);
        const invoice = invoices?.[0];

        if (!invoice) {
          return FormatResponse(404, {
            message: 'Payment approved, but invoice not found',
            error: `Invoice not found for subject_id=${existing.subject_id}`,
          });
        }

        const invoiceUpdateRes = await updateInvoiceHandler(invoice.id as number, {
          ...invoice,
          status: 'PAID',
          updated_at: new Date().toISOString(),
        });

        if (invoiceUpdateRes?.statusCode >= 300) {
          return FormatResponse(500, {
            message: 'Payment approved, but failed to update invoice',
            error: invoiceUpdateRes?.body ?? 'Invoice update handler failed',
          });
        }
      }

      if (existing.subject_type === 'PAYROLL_PAYOUT') {
        const payouts = await payoutDAL.getAllPayouts({ id: existing.subject_id } as any);
        const payout = payouts?.[0];

        if (!payout) {
          return FormatResponse(404, {
            message: 'Payment approved, but payout not found',
            error: `Payout not found for subject_id=${existing.subject_id}`,
          });
        }

        const payoutUpdateRes = await updatePayoutHandler(payout.id as number, {
          ...payout,
          status: 'PAID',
          updated_at: new Date().toISOString(),
          updated_by_user_id: payout.updated_by_user_id ?? payout.pcho_user_id,
        });

        if (payoutUpdateRes?.statusCode >= 300) {
          return FormatResponse(500, {
            message: 'Payment approved, but failed to update payout',
            error: payoutUpdateRes?.body ?? 'Payout update handler failed',
          });
        }
      }
    }

    return FormatResponse(200, {
      message: 'Manual payment approved successfully',
      payment: updatedPayment,
    });
  } catch (error) {
    console.error(`{api: '/update-payment', error: ${error}}`);

    if (error instanceof z.ZodError) {
      console.info('Zod validation error in update payment:', error.errors);

      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }

    return FormatResponse(500, {
      message: 'Failed to update payment',
      error: (error as Error).message,
    });
  }
};
