import { z } from "zod";
import { makeOptionalOnEmpty } from "../../utils/makeOptional";

export const updateHcmTeamMember = z.object({
  role: makeOptionalOnEmpty(z.string().optional()),
  start_date: makeOptionalOnEmpty(z.date().optional()),
  wage: makeOptionalOnEmpty(z.string().optional()),
  // pay_per_hour:makeOptionalOnEmpty(z.number().optional()),
  pay_frequency: z.enum(["Hourly", "Monthly"]).default("Hourly"),
  pay_rate: z
    .number({ message: "pay must be a number" })
    .positive({ message: "pay must be positive" }),
  contractCompletedOn: makeOptionalOnEmpty(z.string().optional()),
  effective_date: makeOptionalOnEmpty(z.string().optional()),
});
