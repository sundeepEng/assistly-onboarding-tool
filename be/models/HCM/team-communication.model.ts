import { z } from "zod";

export const TeamConversationsSchema = z
  .object({
    conversation_id: z
      .string()
      .uuid({ message: "conversation_id has an invalid UUID format" }),
    home_id: z.string().uuid({ message: "home_id has an invalid UUID format" }),
    sender_user_id: z
      .string()
      .uuid({ message: "sender_user_id has an invalid UUID format" }),
    receiver_user_id: z
      .string()
      .uuid({ message: "receiver_user_id has an invalid UUID format" }),
    created_at: z
      .string()
      .datetime({ message: "created_at should be a datetime ISO string" })
      .default(new Date().toISOString())
      .optional(),
    updated_at: z
      .string()
      .datetime({ message: "updated_at should be a datetime ISO string" })
      .default(new Date().toISOString())
      .optional(),
  })
  .strict();

export const GetUserConversationsSchema = z
  .object({
    userId: z.string().uuid({ message: "userId has an invalid UUID format" }),
    homeId: z.string().uuid({ message: "homeId has an invalid UUID format" }),
  })
  .strict();

export const TeamConversationMessagesSchema = z
  .object({
    message_id: z
      .string()
      .uuid({ message: "message_id has an invalid UUID format" }),
    conversation_id: z
      .string()
      .uuid({ message: "conversation_id has an invalid UUID format" }),
    message: z.string().min(1, { message: "message cannot be empty" }),
    sender_user_id: z
      .string()
      .uuid({ message: "sender_user_id has an invalid UUID format" }),
    created_at: z
      .string()
      .datetime({ message: "created_at should be a datetime ISO string" })
      .default(new Date().toISOString())
      .optional(),
  })
  .strict();

export const TeamConversationMessageCombinedSchema =
  TeamConversationsSchema.merge(TeamConversationMessagesSchema).strict();
