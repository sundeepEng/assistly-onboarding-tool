import { z } from "zod";

export const GenerateCertificateSchema = z.object({
  userId: z.string().uuid(),
  moduleName: z.string(),
  moduleId: z.string().uuid(),
});
