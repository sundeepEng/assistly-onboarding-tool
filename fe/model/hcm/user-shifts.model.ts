import { z } from "zod";
import { makeOptionalOnEmpty } from "../../utils/makeOptional";

export const createUserShiftSchema = z
  .object({
    user_id: z.string().uuid().optional(),

    assigned_to_user_id: z.string().uuid().optional(),

    shift_status: z.enum(["available", "timeoff", "vacation"]).optional(),

    shift_color: z.string().nonempty().default("#3b82f6"),

    shift_start_time: z.string(),

    home_id: z.string().uuid().optional(),

    created_by_user_id: z.string().uuid().optional(),

    user_name: z.string().optional(),

    created_by_user_name: z.string().optional(),

    shift_end_time: z.string(),

    is_unavailability_approved: z.boolean().nullable().optional(),

    unavailability_reason: z.string().nullable().optional(),

    pay_rate: z.number().optional(),

    notes: makeOptionalOnEmpty(z.string().max(500).nullable().optional()),

    clock_in_timestamp: z.string().datetime().nullable().optional(),

    clock_out_timestamp: z.string().datetime().nullable().optional(),

    pay_frequency: z.enum(["Hourly", "Monthly"]).default("Hourly"),
  })
  .strict();


// Conditional schema approach - simple and clean
export const createUserShiftSchemaWithHomeType = (isInHomeCare: boolean) => {
  return createUserShiftSchema
    .extend({
      // Use preprocess to handle null values before validation
      assigned_to_user_id: z.preprocess(
        (val) => {
          // Convert null/undefined to undefined for non-in-home care
          if (!isInHomeCare) return undefined;
          // For in-home care, return the value as-is for validation
          return val;
        },
        isInHomeCare
          ? z
              .string()
              .uuid({ message: "Senior selection is required for InHomeCare" })
          : z.string().uuid().optional(),
      ),
    })
    .transform((data) => {
      // For non-in-home care, remove the field completely
      if (!isInHomeCare) {
        const { assigned_to_user_id, ...cleanData } = data;
        return cleanData;
      }
      return data;
    });
};

export const TimeOffSchema = z
  .object({
    shift_date: z.string().optional(),
    shift_start_time: z.string().optional(),
    shift_end_time: z.string().optional(),
    multi_day_start: z.string().optional(),
    multi_day_end: z.string().optional(),
    unavailability_reason: z
      .string({ message: "Reason is required!" })
      .max(500),
    notes: z.string().max(500).optional(),
    isMultipleDays: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.isMultipleDays) {
      if (!data.multi_day_start) {
        ctx.addIssue({
          path: ["multi_day_start"],
          code: z.ZodIssueCode.custom,
          message: "Required",
        });
      }
      if (!data.multi_day_end) {
        ctx.addIssue({
          path: ["multi_day_end"],
          code: z.ZodIssueCode.custom,
          message: "Required",
        });
      }
    } else {
      if (!data.shift_date) {
        ctx.addIssue({
          path: ["shift_date"],
          code: z.ZodIssueCode.custom,
          message: "Date is required",
        });
      }
      if (!data.shift_start_time) {
        ctx.addIssue({
          path: ["shift_start_time"],
          code: z.ZodIssueCode.custom,
          message: "Required",
        });
      }
      if (!data.shift_end_time) {
        ctx.addIssue({
          path: ["shift_end_time"],
          code: z.ZodIssueCode.custom,
          message: "Required",
        });
      }
    }
  });

export const MonthTeamShiftSchema = z.object({
  user_id: z.string().uuid({ message: "Employee is required" }),
});

export const updateUserShiftSchema = z
  .object({
    id: z.number().int().positive(),
    user_id: z.string().uuid(),
    shift_status: z.enum(["available", "timeoff", "vacation"]),
    shift_start_time: z.string().datetime({ offset: false }),
    shift_end_time: z.string().datetime({ offset: false }),
    is_unavailability_approved: z.boolean().nullable().optional(),
    unavailability_reason: z.string().nullable().optional(),
    pay_rate: z.number(),
    notes: z.string().max(500).nullable().optional(),
    assigned_to_user_id: z.string().uuid().optional(),

    // new local fields for form only (optional if you want Zod to help early)
    clock_in_date: z.string().optional(),
    clock_in_time: z.string().optional(),
    clock_out_time: z.string().optional(),
    pay_frequency: z.enum(["Hourly", "Monthly"]).default("Hourly"),
  })
  .strict();

export const AddtimeCardSchema = z.object({
  user_id: z.string().uuid({ message: "Employee is required" }),
  clock_in_date: z.string({ required_error: "Date is required" }),
  role: z.string().max(100).optional(),
  clock_in_time: z.string().optional(),
  clock_out_time: z.string().optional(),
});

export const EditTimeCardSchema = z.object({
  clock_in_time: z.string().optional(),
  clock_out_time: z.string().optional(),
  notes: z.string().max(500).nullable().optional(),
});
