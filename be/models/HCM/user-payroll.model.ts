import { z } from "zod";

export const userPayrollSchema = z
  .object({
    user_id: z.string().uuid({ message: "user_id must be a valid uuid" }),
    home_id: z.string().uuid({ message: "home_id must be a valid uuid" }),
    pay_period_start_date: z.string().date(),
    pay_period_end_date: z.string().date(),
    total_hours: z.number().min(0),
    gross_pay: z.number().min(0),
    deductions: z.number(),
    net_pay: z.number().min(0),
    pay_date: z.string().datetime(),
    payment_method: z.string({ message: "payment_method must be a string" }),
  })
  .strict();

export const getPayrollSchema = userPayrollSchema.extend({
  id: z.number().int().positive(), // Primary key, auto-incremented
});
