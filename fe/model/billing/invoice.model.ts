import { z } from 'zod';
import { makeOptionalOnEmpty } from '../../utils/makeOptional';

export const InvoiceSchema = z
  .object({
    id: z.number({ message: 'id must be a number' }).optional(),
    invoice_id: z.string({ message: 'invoice_id must be a string' }).optional(),
    home_id: z.string().uuid({ message: 'home_id must be a valid uuid' }),
    user_id: z.string().uuid({ message: 'user_id must be a valid uuid' }),
    billing_period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
      message: 'billing_period must be in YYYY-MM format',
    }),
    status: z.enum(['DRAFT', 'DUE', 'OVERDUE', 'VOID','PAID'], {
      message: 'status must be DRAFT, DUE, PAID, or VOID',
    }),
    total_amount: z.number({ message: 'total_amount must be a number' }),
    parent_invoice_id: z
      .number({ message: 'parent_invoice_id must be a valid number' })
      .nullable()
      .optional(),
    due_date: z.string().date(),
    created_by_user_id: z.string().uuid({ message: 'created_by_user_id must be a valid uuid' }),
    notes: makeOptionalOnEmpty(z.string().nullable().optional()),
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
    invoice_id: z
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
    amount: z.number({ message: 'amount must be a number' }),
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


export const InvoiceFormValidationSchema = z.object({
  user_id: z.string().uuid({ message: 'Resident is required' }),
  billing_period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Billing period must be in YYYY-MM format',
  }),
  due_date: z.string().date(),
  notes: z.string().nullable().optional(),
});