import Stripe from 'stripe';
import { getStripeClient, getStripeSecretKeys, mapStripeStatus } from '../../../utils/stripe';
import { UsersDAL } from '../../../dal/users.dal';
import { PaymentDAL } from '../../../dal/payment.dal';
import { InvoiceDAL } from '../../../dal/invoice.dal';
import { PayoutDAL } from '../../../dal/payout.dal';
import { StripeWebhookEventDAL } from '../../../dal/stripe-webhook-event.dal';
import { updateUserHandler } from '../../update-user';

const usersDAL: UsersDAL = new UsersDAL();
const paymentDAL = new PaymentDAL();
const invoiceDAL = new InvoiceDAL();
const payoutDAL = new PayoutDAL();
const webhookEventDAL = new StripeWebhookEventDAL();

type StripeV2Event = {
  id: string;
  object: string; // "v2.core.event"
  type: string;
  livemode?: boolean;
  created?: string;
  related_object?: {
    id?: string;
    type?: string;
    url?: string;
  };
};

type AnyStripeWebhookEvent = Stripe.Event | StripeV2Event;

const getHeaderCI = (headers: Record<string, any> = {}, name: string): string | undefined => {
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) {
      if (Array.isArray(v)) return v[0];
      return typeof v === 'string' ? v : String(v);
    }
  }
  return undefined;
};

export const stripeWebhookHandler = async (event: any) => {
  const stripe = await getStripeClient();

  console.info('Stripe webhook endpoint HIT', {
    path: event?.path,
    httpMethod: event?.httpMethod,
    isBase64Encoded: event?.isBase64Encoded,
  });

  const headers = event?.headers ?? {};
  const multiValueHeaders = event?.multiValueHeaders ?? {};

  const sig =
    getHeaderCI(headers, 'stripe-signature') || getHeaderCI(multiValueHeaders, 'stripe-signature');

  if (!sig) {
    console.error('Missing Stripe signature header', {
      headers,
      multiValueHeaders,
    });
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Missing Stripe signature header' }),
    };
  }

  let stripeEvent: AnyStripeWebhookEvent;

  try {
    const { webhookSecretKeySnapshot, webhookSecretKeyThin } = await getStripeSecretKeys();

    const rawBody = event?.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;

    const secretsToTry = [webhookSecretKeySnapshot, webhookSecretKeyThin].filter(
      Boolean
    ) as string[];

    let verified: AnyStripeWebhookEvent | null = null;
    let verifiedUsing: 'snapshot' | 'thin' | 'unknown' = 'unknown';

    for (const secret of secretsToTry) {
      try {
        verified = stripe.webhooks.constructEvent(
          rawBody,
          sig,
          secret
        ) as unknown as AnyStripeWebhookEvent;
        verifiedUsing =
          secret === webhookSecretKeySnapshot
            ? 'snapshot'
            : secret === webhookSecretKeyThin
              ? 'thin'
              : 'unknown';
        break;
      } catch {}
    }

    if (!verified) {
      console.error('Webhook signature verification failed for snapshot + thin secrets');
      return { statusCode: 400, body: JSON.stringify({ message: 'Invalid Stripe signature' }) };
    }

    stripeEvent = verified;

    console.info('Stripe webhook verified', {
      eventId: stripeEvent.id,
      type: stripeEvent.type,
      verifiedUsing,
    });
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid Stripe signature' }) };
  }

  // ---------- DEDUPE ----------
  try {
    const existing = await webhookEventDAL.getByEventId(stripeEvent.id);
    if (existing?.processed) {
      return { statusCode: 200, body: JSON.stringify({ received: true, deduped: true }) };
    }

    let relatedObjectId: string | null = null;

    // Classic events usually have data.object.id
    if ((stripeEvent as Stripe.Event)?.data?.object) {
      const classicObject: any = (stripeEvent as Stripe.Event).data.object;
      relatedObjectId = classicObject?.id ?? null;
    } else {
      // v2 thin events use related_object.id
      relatedObjectId = (stripeEvent as StripeV2Event).related_object?.id ?? null;
    }

    await webhookEventDAL.insertIfNotExists({
      stripe_event_id: stripeEvent.id,
      event_type: stripeEvent.type,
      related_object_id: relatedObjectId,
    });
  } catch (e) {
    console.error('Webhook dedupe insert failed:', e);
    // proceed; don't block processing on dedupe persistence issues
  }

  console.info(`Stripe event type: ${stripeEvent.type}`);

  try {
    switch (stripeEvent.type) {
      // -------------------
      // CONNECT ONBOARDING
      // -------------------

      // Classic event (if payload style changes later)
      case 'account.updated': {
        const classicEvent = stripeEvent as Stripe.Event;
        await handleAccountUpdated(classicEvent.data.object as Stripe.Account);
        break;
      }

      // v2 thin events
      case 'v2.core.account.created':
      case 'v2.core.account.updated':
      case 'v2.core.account[requirements].updated': {
        const v2Event = stripeEvent as StripeV2Event;
        const accountId = v2Event.related_object?.id;

        if (!accountId) {
          console.warn(`No related_object.id in event ${v2Event.type}`);
          break;
        }

        const account = await stripe.accounts.retrieve(accountId);
        await handleAccountUpdated(account as Stripe.Account);
        break;
      }

      // -------------------
      // PAYMENTS / CHECKOUT
      // -------------------
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          (stripeEvent as Stripe.Event).data.object as Stripe.Checkout.Session
        );
        break;

      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(
          (stripeEvent as Stripe.Event).data.object as Stripe.Checkout.Session
        );
        break;

      case 'checkout.session.async_payment_failed':
        await handleCheckoutSessionAsyncFailed(
          (stripeEvent as Stripe.Event).data.object as Stripe.Checkout.Session
        );
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(
          (stripeEvent as Stripe.Event).data.object as Stripe.PaymentIntent
        );
        break;

      case 'charge.refunded':
        await handleChargeRefunded((stripeEvent as Stripe.Event).data.object as Stripe.Charge);
        break;

      // -------------------
      // IGNORE / NO-OP
      // -------------------
      case 'v1.billing.meter.no_meter_found':
      case 'v2.core.event_destination.ping':
      case 'v2.core.account_person.updated':
        console.info(`Ignoring non-onboarding Stripe event: ${stripeEvent.type}`);
        break;

      default:
        console.info(`Unhandled Stripe event type: ${stripeEvent.type}`);
    }

    // mark processed
    try {
      await webhookEventDAL.markProcessed(stripeEvent.id);
    } catch (e) {
      console.error('Webhook dedupe markProcessed failed:', e);
    }
  } catch (err) {
    console.error('Stripe webhook processing failed:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Webhook processing failed',
        error: (err as Error).message,
      }),
    };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};

// -------------------
// CONNECT ONBOARDING
// -------------------
const handleAccountUpdated = async (account: Stripe.Account) => {
  const stripeAccountId = account.id;
  const onboardingStatus = mapStripeStatus(account);

  let user;
  const metadataUserId = account.metadata?.userId;

  if (metadataUserId) {
    console.info(
      `No user found by stripeAccountId=${stripeAccountId}. Trying metadata.userId=${metadataUserId}`
    );
    user = await usersDAL.fetchUserById(metadataUserId);
  }

  if (!user || Object.keys(user).length === 0) {
    console.info(
      `No user found for Stripe account ${stripeAccountId} (lookup by stripeAccountId and metadata.userId failed)`
    );
    return;
  }

  const updatedUser: any = {
    ...user,
    stripeAccountId, // write back for future consistency
    stripeOnboardingStatus: onboardingStatus,
    stripeChargesEnabled: !!account.charges_enabled,
    stripePayoutsEnabled: !!account.payouts_enabled,
    modifiedAt: new Date().toISOString(),
  };

  // If this causes issues in webhook context, switch to usersDAL.updateUser(updatedUser)
  await updateUserHandler(user.userId, updatedUser);

  console.info(`Stripe account updated: ${stripeAccountId}`, {
    userId: user.userId,
    onboardingStatus,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
  });
};

// -------------------
// PAYMENT HANDLERS
// -------------------

const handleCheckoutSessionCompleted = async (session: Stripe.Checkout.Session) => {
  const payment_id = session.metadata?.payment_id;
  const subject_type = session.metadata?.subject_type as 'INVOICE' | 'PAYROLL_PAYOUT' | undefined;
  const subject_public_id = session.metadata?.subject_public_id;

  if (!payment_id) {
    console.warn('checkout.session.completed missing metadata.payment_id', {
      sessionId: session.id,
    });
    return;
  }

  await paymentDAL.updatePaymentByPaymentId(payment_id, {
    status: session.payment_status === 'paid' ? 'PAID' : 'PENDING',
    stripe_checkout_session_id: session.id,
    stripe_session_status: session.status ?? null,
    stripe_payment_status: (session as any).payment_status ?? null,
    stripe_payment_intent_id:
      typeof session.payment_intent === 'string' ? session.payment_intent : null,
  });

  if (session.payment_status !== 'paid') return;

  if (!subject_type || !subject_public_id) {
    console.warn('checkout.session.completed missing subject metadata', {
      payment_id,
      subject_type,
      subject_public_id,
    });
    return;
  }

  if (subject_type === 'INVOICE') {
    const invoices = await invoiceDAL.getAllInvoices({ invoice_id: subject_public_id } as any);
    const invoice = invoices?.[0];
    if (!invoice) {
      console.warn('Invoice not found for webhook subject_public_id', { subject_public_id });
      return;
    }

    await invoiceDAL.updateInvoice(
      invoice.id as number,
      {
        ...invoice,
        status: 'PAID',
        updated_at: new Date().toISOString(),
        items: invoice.items ?? [],
      } as any
    );
  } else if (subject_type === 'PAYROLL_PAYOUT') {
    const payouts = await payoutDAL.getAllPayouts({ payroll_payout_id: subject_public_id } as any);
    const payout = payouts?.[0];
    if (!payout) {
      console.warn('Payout not found for webhook subject_public_id', { subject_public_id });
      return;
    }

    await payoutDAL.updatePayout(
      payout.id as number,
      {
        ...payout,
        status: 'PAID',
        updated_at: new Date().toISOString(),
        items: payout.items ?? [],
        updated_by_user_id: payout.updated_by_user_id ?? payout.pcho_user_id,
      } as any
    );
  }
};

const handleCheckoutSessionExpired = async (session: Stripe.Checkout.Session) => {
  const payment_id = session.metadata?.payment_id;

  if (!payment_id) {
    const existing = await paymentDAL.getPaymentByStripeCheckoutSessionId(session.id);
    if (existing?.payment_id) {
      await paymentDAL.updatePaymentByPaymentId(existing.payment_id, {
        status: 'EXPIRED',
        stripe_session_status: session.status ?? null,
        stripe_payment_status: (session as any).payment_status ?? null,
      });
    }
    return;
  }

  await paymentDAL.updatePaymentByPaymentId(payment_id, {
    status: 'EXPIRED',
    stripe_checkout_session_id: session.id,
    stripe_session_status: session.status ?? null,
    stripe_payment_status: (session as any).payment_status ?? null,
  });
};

const handleCheckoutSessionAsyncFailed = async (session: Stripe.Checkout.Session) => {
  const payment_id = session.metadata?.payment_id;

  if (!payment_id) {
    const existing = await paymentDAL.getPaymentByStripeCheckoutSessionId(session.id);
    if (existing?.payment_id) {
      await paymentDAL.updatePaymentByPaymentId(existing.payment_id, {
        status: 'FAILED',
        stripe_session_status: session.status ?? null,
        stripe_payment_status: (session as any).payment_status ?? null,
      });
    }
    return;
  }

  await paymentDAL.updatePaymentByPaymentId(payment_id, {
    status: 'FAILED',
    stripe_checkout_session_id: session.id,
    stripe_session_status: session.status ?? null,
    stripe_payment_status: (session as any).payment_status ?? null,
  });
};

const handlePaymentIntentFailed = async (pi: Stripe.PaymentIntent) => {
  const payment_id = (pi.metadata?.payment_id as string | undefined) ?? undefined;

  if (payment_id) {
    await paymentDAL.updatePaymentByPaymentId(payment_id, {
      status: 'FAILED',
      stripe_payment_intent_id: pi.id,
      stripe_payment_status: pi.status ?? null,
    });
    return;
  }

  const existing = await paymentDAL.getPaymentByStripePaymentIntentId(pi.id);
  if (existing?.payment_id) {
    await paymentDAL.updatePaymentByPaymentId(existing.payment_id, {
      status: 'FAILED',
      stripe_payment_intent_id: pi.id,
      stripe_payment_status: pi.status ?? null,
    });
  }
};

const handleChargeRefunded = async (charge: Stripe.Charge) => {
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;

  if (!paymentIntentId) {
    console.warn('charge.refunded missing payment_intent', { chargeId: charge.id });
    return;
  }

  const existing = await paymentDAL.getPaymentByStripePaymentIntentId(paymentIntentId);
  if (!existing?.payment_id) {
    console.warn('No payment row found for refunded payment_intent', { paymentIntentId });
    return;
  }

  const fullyRefunded = (charge.amount_refunded ?? 0) >= (charge.amount ?? 0);
  await paymentDAL.updatePaymentByPaymentId(existing.payment_id, {
    status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
    stripe_charge_id: charge.id,
    stripe_payment_intent_id: paymentIntentId,
  });
};
