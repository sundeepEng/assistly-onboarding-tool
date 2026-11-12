import { z } from "zod";
import { FormatResponse } from "../../utils/response-formatter";
import { TeamConversationMessagesSchema } from "../../models/HCM/team-communication.model";
import { TeamCommunicationDAL } from "../../dal/team-communication.dal";
import { UsersDAL } from "../../dal/users.dal";

const usersDAL: UsersDAL = new UsersDAL();
const teamCommunicationDAL: TeamCommunicationDAL = new TeamCommunicationDAL();

export const getConversationMessagesHandler = async (conversationId: any) => {
  if (!conversationId) {
    console.error(
      "Service/GetConversationMessages/ Error: Path params not provided"
    );
    FormatResponse(400, {
      message: "Failed to fetch conversation messages",
      error: "Missing path params - conversationId",
    });
  }

  try {
    // Zod validation for incoming path params
    z.string().uuid().parse(conversationId);

    let conversationMessages: z.infer<typeof TeamConversationMessagesSchema>[] =
      await teamCommunicationDAL.getConversationMessages(conversationId);

    //Fetch user names for conversations
    const uniqueUserIds = Array.from(
      new Set(
        conversationMessages.flatMap((message) => [message.sender_user_id])
      )
    );

    const users = await usersDAL.batchFetchUsersByIds(uniqueUserIds);

    // Map userId to name
    const userMap = new Map<string, string>(
      users.map((user) => [user.userId, user.name])
    );

    conversationMessages = conversationMessages.map((message) => ({
      ...message,
      sender_user_name: userMap.get(message.sender_user_id) ?? "",
    }));

    return FormatResponse(200, {
      message: "Fetched conversation messages successfully",
      messages: conversationMessages,
    });
  } catch (error) {
    console.error(
      "Service/GetConversationMessages/ Error: ",
      JSON.stringify(error as Error)
    );

    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: "Request payload validation failed",
        error: error.errors,
      });
    }
    return FormatResponse(500, {
      message: "Failed to fetch conversation messages",
      error: error as Error,
    });
  }
};
