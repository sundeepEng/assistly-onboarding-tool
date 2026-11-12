import { z } from 'zod';

/**
 * We will link payments to either:
 * - INVOICE (senior -> pcho)
 * - PAYROLL_PAYOUT (pcho -> pcg)
 */
export const PaymentSubjectTypeSchema = z.enum(['INVOICE', 'PAYROLL_PAYOUT'], {
  message: 'subject_type must be INVOICE or PAYROLL_PAYOUT',
});

export const PaymentProviderSchema = z.enum(['STRIPE', 'MANUAL'], {
  message: 'provider must be STRIPE or MANUAL',
});

export const PaymentStatusSchema = z.enum(
  [
    'CREATED',
    'PENDING',
    'PENDING_APPROVAL',
    'PAID',
    'FAILED',
    'CANCELLED',
    'EXPIRED',
    'REFUNDED',
    'PARTIALLY_REFUNDED',
    'VOID',
  ],
  {
    message:
      'status must be CREATED, PENDING, PENDING_APPROVAL, PAID, FAILED, CANCELLED, EXPIRED, REFUNDED, PARTIALLY_REFUNDED, or VOID',
  }
);

export const ManualPaymentMethodSchema = z.enum(
  ['CASH', 'CHECK', 'BANK_TRANSFER', 'PAYPAL', 'ZELLE', 'VENMO', 'OTHER'],
  {
    message: 'manual_method must be CASH, CHECK, BANK_TRANSFER, PAYPAL, ZELLE, VENMO, or OTHER',
  }
);

/**
 * DB row schema (payments table)
 * - subject_id is numeric (invoice.id or payout.id)
 * - you can also add public UUID references if you like, but numeric is fine
 */
export const CreatePaymentSchema = z
  .object({
    payment_id: z.string().uuid({ message: 'payment_id must be a valid uuid' }),

    subject_type: PaymentSubjectTypeSchema,
    subject_id: z.coerce.number({
      message: 'subject_id must be a number (invoice.id or payout.id)',
    }),

    payer_user_id: z.string().uuid({ message: 'payer_user_id must be a valid uuid' }),
    payee_user_id: z.string().uuid({ message: 'payee_user_id must be a valid uuid' }),

    provider: PaymentProviderSchema,
    status: PaymentStatusSchema,

    currency: z
      .string()
      .length(3, { message: 'currency must be a 3-letter code like usd' })
      .default('usd'),
    amount_cents: z.coerce.number().int().min(0, { message: 'amount_cents must be >= 0' }),

    // -------------------------
    // STRIPE CHECKOUT FIELDS
    // -------------------------
    stripe_connected_account_id: z.string().nullable().optional(), // acct_... (payee connected account)
    stripe_checkout_session_id: z.string().nullable().optional(), // cs_...
    stripe_payment_intent_id: z.string().nullable().optional(), // pi_...
    stripe_charge_id: z.string().nullable().optional(), // ch_...
    stripe_refund_id: z.string().nullable().optional(), // re_...
    stripe_payment_status: z.string().nullable().optional(), // Stripe session.payment_status
    stripe_session_status: z.string().nullable().optional(), // Stripe session.status

    // -------------------------
    // MANUAL PAYMENT FIELDS
    // -------------------------
    manual_method: ManualPaymentMethodSchema.nullable().optional(),
    manual_reference: z.string().nullable().optional(),
    manual_notes: z.string().nullable().optional(),
    manual_paid_at: z.string().datetime().nullable().optional(),

    // safety against retries
    idempotency_key: z.string().min(8, { message: 'idempotency_key is required' }),

    created_at: z
      .string()
      .datetime({ message: 'created_at must be a valid datetime string' })
      .optional(),
    updated_at: z
      .string()
      .datetime({ message: 'updated_at must be a valid datetime string' })
      .optional(),

    created_by_user_id: z.string().uuid({
      message: 'created_by_user_id must be a valid uuid',
    }),
  })
  .strict();

export const UpdatePaymentSchema = CreatePaymentSchema.extend({
  id: z.number({ message: 'id must be a number' }),
}).strict();

export const CreatePaymentRequestSchema = z
  .object({
    subject_type: z.enum(['INVOICE', 'PAYROLL_PAYOUT']),
    subject_public_id: z.string().min(1),
    provider: z.enum(['STRIPE', 'MANUAL']),

    // Stripe-only
    success_url: z.string().url().optional(),
    cancel_url: z.string().url().optional(),

    // Manual-only
    manual_method: z
      .enum(['CASH', 'CHECK', 'BANK_TRANSFER', 'PAYPAL', 'ZELLE', 'VENMO', 'OTHER'])
      .optional(),
    manual_reference: z.string().nullable().optional(),
    manual_notes: z.string().nullable().optional(),
    manual_paid_at: z.string().datetime().optional(),

    payer_user_id: z.string().uuid(),
    initiated_by_user_id: z.string().uuid(),
  })
  .strict();
