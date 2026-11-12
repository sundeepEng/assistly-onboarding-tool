import { z } from "zod";
import { TeamConversationsSchema } from "../../models/HCM/team-communication.model";
import { FormatResponse } from "../../utils/response-formatter";
import { UsersDAL } from "../../dal/users.dal";
import { HomeDAL } from "../../dal/home.dal";
import { TeamCommunicationDAL } from "../../dal/team-communication.dal";
import { UserTypes } from "../../utils/constants";

const usersDAL: UsersDAL = new UsersDAL();
const homeDAL: HomeDAL = new HomeDAL();
const teamCommunicationDAL: TeamCommunicationDAL = new TeamCommunicationDAL();

export const upsertConversationHandler = async (
  conversationData: z.infer<typeof TeamConversationsSchema>
) => {
  if (!conversationData) {
    return FormatResponse(400, {
      message: "Failed to upsert conversation",
      error: "Payload not provided in the body",
    });
  }

  try {
    // Zod validation for incoming payload
    const validatedConversationData =
      TeamConversationsSchema.parse(conversationData);

    console.info("Service/Upsert Conversation/ Data validated successfully");

    const senderDetails = await usersDAL.fetchUserById(
      validatedConversationData.sender_user_id
    );
    const receiverDetails = await usersDAL.fetchUserById(
      validatedConversationData.receiver_user_id
    );

    // #region Validations
    // Check if the sender_user and receiver_user with Id exists in the users table
    if (
      Object.keys(senderDetails)?.length == 0 ||
      Object.keys(receiverDetails)?.length == 0
    ) {
      console.error(
        `Service/Upsert Conversation/ Error: User not found with ID: ${validatedConversationData.sender_user_id}`
      );

      return FormatResponse(404, {
        message: "Failed to upsert conversation",
        error: `sender_user_id - ${validatedConversationData.sender_user_id} or receiver_user_id - ${validatedConversationData.receiver_user_id} not found`,
      });
    }

    if (
      senderDetails.isDeleted === true ||
      receiverDetails.isDeleted === true
    ) {
      console.error(
        `Service/Upsert Conversation/ Error: User is deleted with ID: ${validatedConversationData.sender_user_id} or ${validatedConversationData.receiver_user_id}`
      );

      return FormatResponse(404, {
        message: "Failed to upsert conversation",
        error: `sender_user_id - ${validatedConversationData.sender_user_id} or receiver_user_id - ${validatedConversationData.receiver_user_id} is soft deleted`,
      });
    }

    if (![UserTypes.PCHO, UserTypes.PCG].includes(senderDetails.role)) {
      console.error(
        `Service/Upsert Conversation/ Error: Sender's role is not allowed to start a conversation`
      );

      return FormatResponse(400, {
        message: "Failed to upsert conversation",
        error: "Sender's role is not allowed to start a conversation",
      });
    }

    if (![UserTypes.PCHO, UserTypes.PCG].includes(receiverDetails.role)) {
      console.error(
        `Service/Upsert Conversation/ Error: Receiver's role is not allowed to start a conversation`
      );

      return FormatResponse(400, {
        message: "Failed to upsert conversation",
        error: "Receivers's role is not allowed to start a conversation",
      });
    }

    if (
      Object.keys(await homeDAL.getHomeById(validatedConversationData.home_id))
        ?.length == 0
    ) {
      //Check if the home exists
      console.error(
        `Service/Upsert Conversation/ Error: HomeId not found ${validatedConversationData.home_id}`
      );

      return FormatResponse(400, {
        message: "Failed to upsert conversation",
        error: `Home with homeID - ${validatedConversationData.home_id} not found`,
      });
    }

    // Check for duplicate conversations
    if (
      await teamCommunicationDAL.duplicateConversation(
        validatedConversationData.sender_user_id,
        validatedConversationData.receiver_user_id
      )
    ) {
      return FormatResponse(409, {
        message: "Failed to upsert conversation",
        error: `Conversation between users - ${validatedConversationData.sender_user_id} and ${validatedConversationData.receiver_user_id} already exists`,
      });
    }

    //
    //#endregion

    conversationData = {
      ...validatedConversationData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = await teamCommunicationDAL.upsertConversation(
      conversationData
    );

    return FormatResponse(200, {
      message: "Upsert conversation success",
      conversation: result,
    });
  } catch (error) {
    console.info("Service/Upsert Conversation/ Error: ", JSON.stringify(error));

    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: "Request payload validation failed",
        error: error.errors,
      });
    }
    return FormatResponse(500, {
      message: "Failed to upsert conversation",
      error: error as Error,
    });
  }
};
