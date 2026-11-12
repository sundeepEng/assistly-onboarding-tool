import { z } from "zod";
import {
  TeamConversationMessageCombinedSchema,
  TeamConversationMessagesSchema,
  TeamConversationsSchema,
} from "../../models/HCM/team-communication.model";
import { FormatResponse } from "../../utils/response-formatter";
import { UsersDAL } from "../../dal/users.dal";
import { TeamCommunicationDAL } from "../../dal/team-communication.dal";
import { upsertConversationHandler } from "./upsert-conversation";

const usersDAL: UsersDAL = new UsersDAL();
const teamCommunicationDAL: TeamCommunicationDAL = new TeamCommunicationDAL();

export const upsertConversationMessagesHandler = async (
  requestPayload: z.infer<typeof TeamConversationMessageCombinedSchema>
) => {
  if (!requestPayload) {
    return FormatResponse(400, {
      message: "Failed to upsert message",
      error: "Payload not provided in the body",
    });
  }

  try {
    // Find conversation
    const conversation: z.infer<typeof TeamConversationsSchema> | undefined =
      await teamCommunicationDAL.getConversationById(
        requestPayload.conversation_id
      );

    // If conversation does not exist, then create one
    if (!conversation) {
      console.info(
        `Service/Upsert Message/ Conversation not found, creating new conversation`
      );

      const newConversation = {
        conversation_id: requestPayload.conversation_id,
        home_id: requestPayload.home_id,
        sender_user_id: requestPayload.sender_user_id,
        receiver_user_id: requestPayload.receiver_user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await upsertConversationHandler(newConversation);
    }

    console.info(
      `Service/Upsert Message/ Conversation found, skip conversation creation`
    );

    const messageData = {
      message_id: requestPayload.message_id,
      message: requestPayload.message,
      conversation_id: requestPayload.conversation_id,
      sender_user_id: requestPayload.sender_user_id,
      created_at: new Date().toISOString(),
    };

    // Zod validation for incoming payload
    let validatedMessageData =
      TeamConversationMessagesSchema.parse(messageData);

    console.info("Service/Upsert Message/ Data validated successfully");

    const senderDetails = await usersDAL.fetchUserById(
      validatedMessageData.sender_user_id
    );

    // #region Validations
    // Check if the user exists
    if (Object.keys(senderDetails)?.length == 0) {
      console.error(
        `Service/Upsert Message/ Error: User not found with ID: ${validatedMessageData.sender_user_id}`
      );

      return FormatResponse(400, {
        message: "Failed to upsert message",
        error: `sender_user_id - ${validatedMessageData.sender_user_id} not found`,
      });
    }

    // Check if the user is deleted
    if (senderDetails.isDeleted === true) {
      console.error(
        `Service/Upsert Message/ Error: User is deleted with ID: ${validatedMessageData.sender_user_id}`
      );

      return FormatResponse(404, {
        message: "Failed to upsert message",
        error: `sender_user_id - ${validatedMessageData.sender_user_id} is soft deleted`,
      });
    }

    //Check if the sender_user is part of the conversation

    if (
      conversation &&
      conversation.sender_user_id !== validatedMessageData.sender_user_id &&
      conversation.receiver_user_id !== validatedMessageData.sender_user_id
    ) {
      console.error(
        `Service/Upsert Message/ Error: User ${validatedMessageData.sender_user_id} is not part of conversation ${validatedMessageData.conversation_id}`
      );

      return FormatResponse(403, {
        message: "Failed to upsert message",
        error:
          "User is not part of the conversation. Hence, not authorized to send messages in this conversation",
      });
    }

    //#endregion

    const result = await teamCommunicationDAL.upsertMessage(
      validatedMessageData
    );

    console.info("Upsert message success", JSON.stringify(result));

    // Update conversation's updated_at timestamp when new message is added
    const updatedConversation = await teamCommunicationDAL.updateConversation(
      validatedMessageData.conversation_id
    );

    console.info("Updated conversation", JSON.stringify(updatedConversation));

    return FormatResponse(200, {
      message: "Upsert message success",
      conversation: result,
    });
  } catch (error) {
    console.info("Service/Upsert Message/ Error: ", JSON.stringify(error));

    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: "Request payload validation failed",
        error: error.errors,
      });
    }
    return FormatResponse(500, {
      message: "Failed to upsert message",
      error: error as Error,
    });
  }
};
