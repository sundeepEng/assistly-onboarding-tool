import { z } from "zod";

export const TeamRoasterSchema = z
  .object({
    user_id: z.string().uuid({ message: "user_id must be a valid uuid" }),
    home_id: z.string().uuid({ message: "home_id must be a valid uuid" }),
    pay_frequency: z.enum(["Hourly", "Monthly"]).default("Hourly"),
    pay_rate: z
      .number({ message: "pay_rate must be a number" })
      .positive({ message: "pay_rate must be positive" }),
    preferred_shift_availability: z
      .string({ message: "preferred_shift_availability must be a string" })
      .nullable()
      .optional(),
    work_status: z
      .enum(["active", "vacation"], {
        message: "work_status can only have values - active, vacation",
      })
      .default("active"),
    skills: z
      .string({ message: "skills must be a string" })
      .nullable()
      .optional(),
  })
  .strict();
