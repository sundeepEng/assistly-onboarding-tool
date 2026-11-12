import { z } from "zod";

export const SupportAttachmentSchema = z
  .object({
    filename: z.string({ message: "Filename must be a string" }).min(1),
    contentType: z
      .string({ message: "Content type must be a valid mime type" })
      .min(1),
    data: z
      .string({ message: "Data must be a base64 string" })
      .regex(/^[A-Za-z0-9+/=]+$/, { message: "data must be base64 encoded" }),
  })
  .strict();

export const SupportRequestSchema = z
  .object({
    userEmail: z
      .string({ message: "User email must be a string" }),
    subject: z.string({ message: "Subject must be a string" }).min(1),
    body: z.string({ message: "Body must be a string" }).min(1),
    attachments: z.array(SupportAttachmentSchema).optional(),
  })
  .strict();

export type SupportAttachment = z.infer<typeof SupportAttachmentSchema>;
export type SupportRequest = z.infer<typeof SupportRequestSchema>;
