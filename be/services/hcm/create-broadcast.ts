import { z } from "zod";
import { CreateTeamBroadcastSchema } from "../../models/HCM/team-broadcast.model";
import { FormatResponse } from "../../utils/response-formatter";
import { TeamBroadcastDAL } from "../../dal/team-broadcast.dal";
import { UsersDAL } from "../../dal/users.dal";
import { HomeDAL } from "../../dal/home.dal";

const teamBroadcastDAL: TeamBroadcastDAL = new TeamBroadcastDAL();
const usersDAL: UsersDAL = new UsersDAL();
const homeDAL: HomeDAL = new HomeDAL();

export const createBroadcastHandler = async (
  newBroadcastData: z.infer<typeof CreateTeamBroadcastSchema>
) => {
  if (!newBroadcastData) {
    console.error("Error in create broadcast service - No body provided");

    return FormatResponse(400, {
      message: "Failed to create broadcast",
      error: "No body provided",
    });
  }

  const { home_id, sender_user_id } = newBroadcastData;

  try {
    let validatedData = CreateTeamBroadcastSchema.parse(newBroadcastData);

    //#region Validate if user exists
    const userDetails = await usersDAL.fetchUserById(sender_user_id);

    if (Object.keys(userDetails)?.length === 0) {
      console.error(
        `{api: '/create-broadcast', error: User not found with ID: ${sender_user_id}}`
      );

      return FormatResponse(400, {
        message: "Failed to create shift",
        error: `User with userID - ${sender_user_id} not found`,
      });
    }

    // If the user is soft deleted, return error
    if (userDetails.isDeleted === true) {
      return FormatResponse(404, {
        message: "Failed to update shift",
        error: `Cannot create shift for the user with userId - ${sender_user_id} as the record is soft deleted`,
      });
    }
    //#endregion

    //#region Validate if home exists
    if (Object.keys(await homeDAL.getHomeById(home_id))?.length == 0) {
      console.error(
        `{api: '/create-broadcast', error: Home not found with ID: ${home_id}}`
      );

      return FormatResponse(400, {
        message: "Failed to create shift",
        error: `Home with homeID - ${home_id} not found`,
      });
    }
    //#endregion

    validatedData = { ...validatedData, created_at: new Date().toISOString() };

    const result = await teamBroadcastDAL.createBroadcast(validatedData);

    return FormatResponse(201, {
      message: "Broadcast created successfully",
      broadcast: result,
    });
  } catch (error) {
    console.error(
      "Error in Create Broadcast Service: ",
      JSON.stringify(error as Error)
    );

    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: "Request payload validation failed",
        error: error.errors,
      });
    }

    return FormatResponse(500, {
      message: "Failed to create broadcast",
      error: JSON.stringify(error as Error),
    });
  }
};
