import { z } from 'zod';

/**
 * Request body schema to create Stripe Checkout Session for a subject
 * - subject is determined by path param in endpoint (invoice_id or payroll_payout_id),
 *   but we keep this schema generic so you can reuse
 */
export const CreateStripeCheckoutSessionSchema = z
  .object({
    success_url: z.string().url({ message: 'success_url must be a valid URL' }),
    cancel_url: z.string().url({ message: 'cancel_url must be a valid URL' }),

    payer_user_id: z.string().uuid({
      message: 'payer_user_id must be a valid uuid',
    }),

    // Optional override; normally computed from invoice/payout totals
    amount_cents: z.number().int().min(0),
    currency: z.string().length(3),
  })
  .strict();

/**
 * OPTIONAL BUT RECOMMENDED:
 * Webhook dedupe table schema (stripe_webhook_event)
 */
export const StripeWebhookEventSchema = z
  .object({
    id: z.number().optional(),
    stripe_event_id: z.string().min(3, { message: 'stripe_event_id is required' }), // evt_...
    event_type: z.string().min(3, { message: 'event_type is required' }),
    processed: z.boolean().default(false),
    processed_at: z.string().datetime().nullable().optional(),
    related_object_id: z.string().nullable().optional(),
    created_at: z.string().datetime().optional(),
  })
  .strict();
