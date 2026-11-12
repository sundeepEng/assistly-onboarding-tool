import { z } from "zod";
import { FormatResponse } from "../../utils/response-formatter";
import {
  GetUserConversationsSchema,
  TeamConversationsSchema,
} from "../../models/HCM/team-communication.model";
import { HomeDAL } from "../../dal/home.dal";
import { TeamCommunicationDAL } from "../../dal/team-communication.dal";
import { UsersDAL } from "../../dal/users.dal";

const usersDAL: UsersDAL = new UsersDAL();
const homeDAL: HomeDAL = new HomeDAL();
const teamCommunicationDAL: TeamCommunicationDAL = new TeamCommunicationDAL();

export const getUserConversationsHandler = async (requestPayload: any) => {
  if (!requestPayload) {
    console.error(
      "Service/GetUserConversations/ Error: Query params not provided"
    );
    FormatResponse(400, {
      message: "Failed to fetch conversations for user",
      error: "Missing query params - userId or homeId",
    });
  }

  try {
    // Zod validation for incoming query params
    GetUserConversationsSchema.parse(requestPayload);

    // #region Validations
    // Check if the user exists in the users table
    if (
      Object.keys(await usersDAL.fetchUserById(requestPayload.userId))
        ?.length == 0
    ) {
      console.error(
        `Service/GetUserConversations/ Error: User not found with ID: ${requestPayload.userId}`
      );

      return FormatResponse(400, {
        message: "Failed to fetch conversations for user",
        error: `User with userID - ${requestPayload.userId} not found`,
      });
    }

    // Check if the home exists
    if (
      Object.keys(await homeDAL.getHomeById(requestPayload.homeId))?.length == 0
    ) {
      console.error(
        `Service/GetUserConversations/ Error: HomeId not found ${requestPayload.homeId}`
      );

      return FormatResponse(400, {
        message: "Failed to fetch conversations for user",
        error: `Home with homeID - ${requestPayload.homeId} not found`,
      });
    }
    //#endregion

    let userConversations: z.infer<typeof TeamConversationsSchema>[] =
      await teamCommunicationDAL.getUserConversations(
        requestPayload.userId,
        requestPayload.homeId
      );

    //Fetch user names for conversations
    const uniqueUserIds = Array.from(
      new Set(
        userConversations.flatMap((conversation) => [
          conversation.sender_user_id,
          conversation.receiver_user_id,
        ])
      )
    );

    const users = await usersDAL.batchFetchUsersByIds(uniqueUserIds);

    // Map userId to name
    const userMap = new Map<string, string>(
      users.map((user) => [user.userId, user.name])
    );

    userConversations = userConversations.map((conversation) => ({
      ...conversation,
      sender_user_name: userMap.get(conversation.sender_user_id) ?? "",
      receiver_user_name: userMap.get(conversation.receiver_user_id) ?? "",
    }));

    return FormatResponse(200, {
      message: "Fetched conversations for the user successfully",
      conversations: userConversations,
    });
  } catch (error) {
    console.error(
      "Service/GetUserConversations/ Error: ",
      JSON.stringify(error as Error)
    );

    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: "Request payload validation failed",
        error: error.errors,
      });
    }
    return FormatResponse(500, {
      message: "Failed to fetch conversations for the user",
      error: error as Error,
    });
  }
};
