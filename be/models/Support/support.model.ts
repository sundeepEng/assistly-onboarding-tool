import { z } from 'zod';

export const SupportAttachmentSchema = z
  .object({
    filename: z.string({ message: 'filename must be a string' }).min(1),
    contentType: z.string({ message: 'contentType must be a valid mime type' }).min(1),
    data: z
      .string({ message: 'data must be a base64 string' })
      .regex(/^[A-Za-z0-9+/=]+$/, { message: 'data must be base64 encoded' }),
  })
  .strict();

export const SupportRequestSchema = z
  .object({
    userEmail: z
      .string({ message: 'userEmail must be a string' })
      .email({ message: 'Invalid email address' }),
    subject: z.string({ message: 'subject must be a string' }).min(1),
    body: z.string({ message: 'body must be a string' }).min(1),
    attachments: z.array(SupportAttachmentSchema).optional(),
  })
  .strict();
