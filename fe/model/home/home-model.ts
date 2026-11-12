import z from "zod";

import { withNullsAsUndefined } from "../../utils/zodUtils";

export const uploadTraningModule = z
  .object({
    moduleName: z.string().min(1, { message: "Module Title is required" }),
    moduleDescription: z
      .string()
      .min(1, { message: "Description is required" }),
    certificateDurationType: z
      .string()
      .min(1, { message: "Certificate duration is required" }),
    certificateDurationCustomDays: z
      .number({ invalid_type_error: "Enter valid days" })
      .min(1, { message: "Days must be at least 1" })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.certificateDurationType === "custom")
        return !!data.certificateDurationCustomDays;
      return true;
    },
    {
      message: "Please enter custom days",
      path: ["certificateDurationCustomDays"],
    },
  );

export const HomeDetailsSchema = withNullsAsUndefined(
  z
    .object({
      homeName: z.string().min(1, "Home name is required"),
      homeCapacity: z
        .number({ invalid_type_error: "Capacity must be a number" })
        .min(1, "Capacity must be at least 1")
        .optional(),
      homeAddress: z
        .object({
          street: z.string().nonempty({ message: "Street is required" }),
          city: z
            .string()
            .nonempty({ message: "City is required" })
            .regex(/^[A-Za-z\s]+$/, {
              message: "City accepts only alphabets",
            }),
          state: z
            .string()
            .nonempty({ message: "State is required" })
            .regex(/^[A-Za-z\s]+$/, {
              message: "State accepts only alphabets",
            }),
          zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, {
            message: "Zip Code has invalid format",
          }),
        })
        .strip()
        .optional(),
    })
    .strip(),
);

const IncomeBudgetSchema = z.object({
  careFee: z.number().optional(),
  monthlyFee: z.number().optional(),
  entertainment: z.number().optional(),
  transport: z.number().optional(),
  medical: z.number().optional(),
  misc: z.number().optional(),
});

const ExpenseBudgetSchema = z.object({
  payroll: z.number().optional(),
  groceries: z.number().optional(),
  utilities: z.number().optional(),
  entertainment: z.number().optional(),
  transport: z.number().optional(),
  medical: z.number().optional(),
  misc: z.number().optional(),
});

export const ExpenseThresholdItemSchema = z
  .object({
    thresholdName: z
      .string()
      .nonempty({ message: "ThresholdName is required" }),
    fixedAmount: z
      .number({ message: "FixedAmount must be a number" })
      .min(0, { message: "FixedAmount must be 0 or greater" }),
    isEnabled: z.boolean().default(true),
    createdAt: z
      .string()
      .datetime({ message: "CreatedAt must be a valid datetime" })
      .optional(),
    modifiedAt: z
      .string()
      .datetime({ message: "ModifiedAt must be a valid datetime" })
      .optional(),
  })
  .strict();

export const AddThresholdFormSchema = z.object({
  thresholdName: z.string().nonempty({ message: "Threshold Name is required" }),
  category: z.string().nonempty({ message: "Category is required" }),
  month: z.string().nonempty({ message: "Month is required" }),
  fixedAmount: z
    .number({ message: "Fixed Amount must be a number" })
    .min(0, { message: "Fixed Amount must be 0 or greater" }),
  isEnabled: z.boolean().default(true),
});

const ExpenseThresholdMonthSchema = z
  .object({
    groceries: ExpenseThresholdItemSchema.optional(),
    utilities: ExpenseThresholdItemSchema.optional(),
    entertainment: ExpenseThresholdItemSchema.optional(),
    transport: ExpenseThresholdItemSchema.optional(),
    medical: ExpenseThresholdItemSchema.optional(),
    misc: ExpenseThresholdItemSchema.optional(),
  })
  .strict();

const BudgetMonthSchema = z.object({
  income: IncomeBudgetSchema.optional(),
  expense: ExpenseBudgetSchema.optional(),
});

// Main budget schema that matches backend structure
export const BudgetSchema = z
  .object({
    budget: z
      .record(
        z.string().regex(/^\d{4}$/, "Year must be a 4 digit string"),
        z.object({
          jan: BudgetMonthSchema.optional(),
          feb: BudgetMonthSchema.optional(),
          mar: BudgetMonthSchema.optional(),
          apr: BudgetMonthSchema.optional(),
          may: BudgetMonthSchema.optional(),
          jun: BudgetMonthSchema.optional(),
          jul: BudgetMonthSchema.optional(),
          aug: BudgetMonthSchema.optional(),
          sep: BudgetMonthSchema.optional(),
          oct: BudgetMonthSchema.optional(),
          nov: BudgetMonthSchema.optional(),
          dec: BudgetMonthSchema.optional(),
        }),
      )
      .optional(),
  })
  .optional();

export const BudgetThresholdsSchema = z.object({
  thresholds: z
    .record(
      z.string().regex(/^\d{4}$/, "Year must be a 4 digit string"),
      z
        .object({
          jan: ExpenseThresholdMonthSchema.optional(),
          feb: ExpenseThresholdMonthSchema.optional(),
          mar: ExpenseThresholdMonthSchema.optional(),
          apr: ExpenseThresholdMonthSchema.optional(),
          may: ExpenseThresholdMonthSchema.optional(),
          jun: ExpenseThresholdMonthSchema.optional(),
          jul: ExpenseThresholdMonthSchema.optional(),
          aug: ExpenseThresholdMonthSchema.optional(),
          sep: ExpenseThresholdMonthSchema.optional(),
          oct: ExpenseThresholdMonthSchema.optional(),
          nov: ExpenseThresholdMonthSchema.optional(),
          dec: ExpenseThresholdMonthSchema.optional(),
        })
        .strict(),
    )
    .optional(),
});
