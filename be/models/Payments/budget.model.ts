import { z } from 'zod';

// Enums for transaction type, entry mode, and category types
export const BudgetTransactionTypeSchema = z.enum(['income', 'expense'], {
  message: "transaction_type must be 'income' or 'expense'",
});

export const BudgetEntryModeSchema = z.enum(['one_time', 'recurring'], {
  message: "entry_mode must be 'one_time' or 'recurring'",
});

export const BudgetIncomeCategorySchema = z.enum(
  ['CARE_FEE', 'MONTHLY_FEE', 'ENTERTAINMENT', 'TRANSPORT', 'MEDICAL', 'MISC'],
  {
    message:
      "category_type must be one of ['CARE_FEE', 'MONTHLY_FEE', 'ENTERTAINMENT', 'TRANSPORT', 'MEDICAL', 'MISC']",
  }
);

export const BudgetExpenseCategorySchema = z.enum(
  ['GROCERIES', 'UTILITIES', 'ENTERTAINMENT', 'TRANSPORT', 'MEDICAL', 'MISC'],
  {
    message:
      "category_type must be one of ['GROCERIES', 'UTILITIES', 'ENTERTAINMENT', 'TRANSPORT', 'MEDICAL', 'MISC']",
  }
);

export const BudgetCategoryTypeSchema = z.union([
  BudgetIncomeCategorySchema,
  BudgetExpenseCategorySchema,
]);

// Schemas for budget
const BudgetBaseSchema = z
  .object({
    id: z.coerce.number({ message: 'id must be a number' }).optional(),
    home_id: z.string().uuid({ message: 'home_id must be a valid uuid' }),
    amount_cents: z.coerce.number().int().min(0),
    transaction_date: z.string().date(),
    created_by_user_id: z.string().uuid({ message: 'created_by_user_id must be a valid uuid' }),
    description: z.string().min(1),
    entry_mode: BudgetEntryModeSchema,
    receipt_url: z.string().url().nullable().optional(),
    notes: z.string().nullable().optional(),
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

const BudgetIncomeSchema = BudgetBaseSchema.extend({
  transaction_type: z.literal('income'),
  category_type: BudgetIncomeCategorySchema,
}).strict();

const BudgetExpenseSchema = BudgetBaseSchema.extend({
  transaction_type: z.literal('expense'),
  category_type: BudgetExpenseCategorySchema,
}).strict();

export const BudgetSchema = z.discriminatedUnion('transaction_type', [
  BudgetIncomeSchema,
  BudgetExpenseSchema,
]);

// Schemas for creating and updating budgets
const CreateBudgetBaseSchema = BudgetBaseSchema.omit({ id: true }).strict();

const CreateBudgetIncomeSchema = CreateBudgetBaseSchema.extend({
  transaction_type: z.literal('income'),
  category_type: BudgetIncomeCategorySchema,
}).strict();

const CreateBudgetExpenseSchema = CreateBudgetBaseSchema.extend({
  transaction_type: z.literal('expense'),
  category_type: BudgetExpenseCategorySchema,
}).strict();

export const CreateBudgetSchema = z.discriminatedUnion('transaction_type', [
  CreateBudgetIncomeSchema,
  CreateBudgetExpenseSchema,
]);

const UpdateBudgetBaseSchema = BudgetBaseSchema.extend({
  id: z.coerce.number({ message: 'id must be a number' }),
}).strict();

const UpdateBudgetIncomeSchema = UpdateBudgetBaseSchema.extend({
  transaction_type: z.literal('income'),
  category_type: BudgetIncomeCategorySchema,
}).strict();

const UpdateBudgetExpenseSchema = UpdateBudgetBaseSchema.extend({
  transaction_type: z.literal('expense'),
  category_type: BudgetExpenseCategorySchema,
}).strict();

export const UpdateBudgetSchema = z.discriminatedUnion('transaction_type', [
  UpdateBudgetIncomeSchema,
  UpdateBudgetExpenseSchema,
]);

// Schemas for getting budget dashboard metrics
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const BudgetDashboardMetricsSchema = z
  .object({
    home_id: z.string().uuid({ message: 'home_id must be a valid uuid' }),

    start_date: z.string().regex(dateRegex, {
      message: 'start_date must be in YYYY-MM-DD format',
    }),

    end_date: z.string().regex(dateRegex, {
      message: 'end_date must be in YYYY-MM-DD format',
    }),
  })
  .strict()
  .superRefine((data, ctx) => {
    const start = new Date(data.start_date);
    const end = new Date(data.end_date);

    if (start > end) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end_date'],
        message: 'end_date must be greater than or equal to start_date',
      });
    }
  });
