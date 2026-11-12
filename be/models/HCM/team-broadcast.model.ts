import { z } from "zod";

export const CreateTeamBroadcastSchema = z
  .object({
    home_id: z.string().uuid({ message: "home_id has an invalid UUID format" }),
    sender_user_id: z
      .string()
      .uuid({ message: "sender_user_id has an invalid UUID format" }),
    message: z.string().min(1, { message: "message cannot be empty" }),
    created_at: z
      .string()
      .datetime({ message: "created_at should be a datetime ISO string" })
      .default(new Date().toISOString()),
  })
  .strict();

export const TeamBroadcastSchema = CreateTeamBroadcastSchema.extend({
  id: z.number().int().positive(),
}).strict();
