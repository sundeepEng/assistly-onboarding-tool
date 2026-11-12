import { z } from "zod";

export const webVitalsSchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.number(),
  path: z.string(),
  userAgent: z.string().optional(),
  label: z.string().optional(),
});
