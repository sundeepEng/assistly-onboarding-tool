import { z } from 'zod';

export const InvoiceSchema = z
  .object({
    id: z.coerce.number({ message: 'id must be a number' }).optional(),
    invoice_id: z.string({ message: 'invoice_id must be a string' }).optional(),
    home_id: z.string().uuid({ message: 'home_id must be a valid uuid' }),
    user_id: z.string().uuid({ message: 'user_id must be a valid uuid' }),
    billing_period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
      message: 'billing_period must be in YYYY-MM format',
    }),
    status: z.enum(['DRAFT', 'DUE', 'PAID', 'VOID'], {
      message: 'status must be DRAFT, DUE, PAID, or VOID',
    }),
    total_amount: z.coerce.number({ message: 'total_amount must be a number' }),
    parent_invoice_id: z.coerce
      .number({ message: 'parent_invoice_id must be a valid number' })
      .nullable()
      .optional(),
    due_date: z.string().date(),
    notes: z.string().nullable().optional(),
    created_by_user_id: z.string().uuid(),
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

export const InvoiceItemSchema = z
  .object({
    invoice_item_id: z.string().uuid({ message: 'invoice_item_id must be a valid uuid' }),
    invoice_id: z.coerce
      .number({ message: 'invoice_id must be a number and references id in invoice' })
      .optional(),
    item_category: z.enum(
      ['CARE_FEE', 'MONTHLY_FEE', 'ENTERTAINMENT', 'TRANSPORT', 'MEDICAL', 'MISC'],
      {
        message:
          'item_category must be CARE_FEE, MONTHLY_FEE, ENTERTAINMENT, TRANSPORT, MEDICAL, or MISC',
      }
    ),
    description: z
      .string({ message: 'description must be a string' })
      .nonempty({ message: 'description is required' }),
    amount: z.coerce.number({ message: 'amount must be a number' }),
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

export const InvoiceWithItemsSchema = InvoiceSchema.extend({
  items: z.array(InvoiceItemSchema),
}).strict();
