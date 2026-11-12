import { z } from 'zod';

export const BudgetTransactionTypeSchema = z.enum(['income', 'expense']);

export const BudgetEntryModeSchema = z.enum(['one_time', 'recurring']);

export const BudgetIncomeCategorySchema = z.enum([
  'CARE_FEE',
  'MONTHLY_FEE', 
  'ENTERTAINMENT',
  'TRANSPORT',
  'MEDICAL',
  'MISC'
], { errorMap: () => ({ message: 'Please select a category' }) });

export const BudgetExpenseCategorySchema = z.enum([
  'GROCERIES',
  'UTILITIES',
  'ENTERTAINMENT',
  'TRANSPORT',
  'MEDICAL',
  'MISC'
], { errorMap: () => ({ message: 'Please select a category' }) });

export const BudgetSchema = z
  .object({
    id: z.coerce.number().optional(),
    transaction_type: BudgetTransactionTypeSchema,
    category_type: z.union([BudgetIncomeCategorySchema, BudgetExpenseCategorySchema], { errorMap: () => ({ message: 'Please select a category' }) }),
    home_id: z.string().uuid('home_id must be a valid uuid'),
    amount_cents: z.coerce.number().min(0, 'amount_cents must be a non-negative number'),
    transaction_date: z.string().date('transaction_date must be a valid date'),
    created_by_user_id: z.string().uuid('created_by_user_id must be a valid uuid'),
    description: z.string().min(1, 'Description is required').max(500, 'Description must not exceed 500 characters'),
    entry_mode: BudgetEntryModeSchema,
    notes: z.string().max(1000, 'Notes must not exceed 1000 characters').nullable().optional(),
    receipt_url: z.string().url().nullable().optional(),
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
  });

export type BudgetTransactionType = z.infer<typeof BudgetTransactionTypeSchema>;
export type BudgetEntryMode = z.infer<typeof BudgetEntryModeSchema>;
export type BudgetIncomeCategory = z.infer<typeof BudgetIncomeCategorySchema>;
export type BudgetExpenseCategory = z.infer<typeof BudgetExpenseCategorySchema>;
export type BudgetCategory = BudgetIncomeCategory | BudgetExpenseCategory;
export type Budget = z.infer<typeof BudgetSchema>;
