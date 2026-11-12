import { z } from 'zod';

export const PayOutItemSchema = z
  .object({
    payout_item_id: z.string().uuid({
      message: 'payout_item_id must be a valid uuid',
    }),
    payout_id: z.number({ message: 'payout_id must be a number and references id in payout' }),
    description: z.string().min(1, {
      message: 'description is required',
    }),
    amount_cents: z.number().int({
      message: 'amount_cents must be an integer (can be negative for deductions)',
    }),
    created_at: z
      .string()
      .datetime({ message: 'created_at must be a valid datetime string' })
      .optional(),
    updated_at: z
      .string()
      .datetime({ message: 'updated_at must be a valid datetime string' })
      .optional(),
  })
  .strict();

export const PayOutSchema = z
  .object({
    id: z.number({ message: 'id must be a number' }).optional(),
    payroll_payout_id: z.string({ message: 'payroll_payout_id must be a string' }),
    home_id: z.string().uuid({ message: 'home_id must be a valid uuid' }),
    pcho_user_id: z.string().uuid({ message: 'pcho_user_id must be a valid uuid' }),
    pcg_user_id: z.string().uuid({ message: 'pcg_user_id must be a valid uuid' }),
    period_type: z.enum(['BIWEEKLY', 'MONTHLY'], {
      message: 'period_type must be BIWEEKLY or MONTHLY',
    }),
    period_label: z.string().nullable().optional(),
    period_start_date: z.string().date(),
    period_end_date: z.string().date(),
    hours_worked_minutes: z.number().int().min(0).optional(),
    hourly_rate_cents: z.number().int().min(0).optional(),
    base_amount_cents: z.number().int().min(0),
    total_amount_cents: z.number().int().min(0),
    status: z.enum(['DRAFT', 'FINALIZED', 'PAID', 'VOID'], {
      message: 'status must be DRAFT, FINALIZED, PAID, or VOID',
    }),
    notes: z.string().nullable().optional(),
    created_at: z
      .string()
      .datetime({ message: 'created_at must be a valid datetime string' })
      .optional(),
    updated_at: z
      .string()
      .datetime({ message: 'updated_at must be a valid datetime string' })
      .optional(),
    updated_by_user_id: z.string().uuid(),
  })
  .strict();

export const PayOutWithItemsSchema = PayOutSchema.extend({
  items: z.array(PayOutItemSchema),
}).strict();

export type PayOut = z.infer<typeof PayOutSchema>;
export type PayOutItem = z.infer<typeof PayOutItemSchema>;
export type PayOutWithItems = z.infer<typeof PayOutWithItemsSchema>;

export const CreatePaymentRequestSchema = z
  .object({
    subject_type: z.enum(["INVOICE", "PAYROLL_PAYOUT"]),
    subject_public_id: z.string().min(1),
    provider: z.enum(["STRIPE", "MANUAL"]),

    // Stripe-only
    success_url: z.string().url().optional(),
    cancel_url: z.string().url().optional(),

    // Manual-only
    manual_method: z
      .enum([
        "CASH",
        "CHECK",
        "BANK_TRANSFER",
        "PAYPAL",
        "ZELLE",
        "VENMO",
        "OTHER",
      ])
      .optional(),
    manual_reference: z.string().nullable().optional(),
    manual_notes: z.string().nullable().optional(),
    manual_paid_at: z.string().datetime().optional(),

    payer_user_id: z.string().uuid(),
    initiated_by_user_id: z.string().uuid(),
  })
  .strict();

export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;
