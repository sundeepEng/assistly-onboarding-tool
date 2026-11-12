import { z } from "zod";
import { UsersDAL } from "../../dal/users.dal";
import { FormatResponse } from "../../utils/response-formatter";
import { TeamBroadcastDAL } from "../../dal/team-broadcast.dal";
import { TeamBroadcastSchema } from "../../models/HCM/team-broadcast.model";
import { HomeDAL } from "../../dal/home.dal";

const teamBroadcastDAL: TeamBroadcastDAL = new TeamBroadcastDAL();
const usersDAL: UsersDAL = new UsersDAL();
const homeDAL: HomeDAL = new HomeDAL();

export const getAllBroadcastsHandler = async (queryParams?: any) => {
  try {
    let allBroadcasts: z.infer<typeof TeamBroadcastSchema>[] =
      queryParams && Object.keys(queryParams).length > 0
        ? await teamBroadcastDAL.getAllBroadcasts(queryParams)
        : await teamBroadcastDAL.getAllBroadcasts();

    // Collect unique user IDs
    const uniqueUserIds = Array.from(
      new Set(allBroadcasts.flatMap((broadcast) => [broadcast.sender_user_id]))
    );

    // Collect unique home IDs
    const uniqueHomeIds = Array.from(
      new Set(allBroadcasts.flatMap((broadcast) => [broadcast.home_id]))
    );

    // Batch fetch users from DynamoDB
    const users = await usersDAL.batchFetchUsersByIds(uniqueUserIds);
    const homes = await homeDAL.batchFetchHomesByIds(uniqueHomeIds);

    // Map userId to name
    const userMap = new Map<string, string>(
      users.map((user) => [user.userId, user.name])
    );

    // Map homeId to name
    const homeMap = new Map<string, string>(
      homes.map((home) => [home.homeId, home.homeName])
    );

    // Enrich shifts with user names and home names
    allBroadcasts = allBroadcasts.map((broadcast) => ({
      ...broadcast,
      user_name: userMap.get(broadcast.sender_user_id) ?? "",
      home_name: homeMap.get(broadcast.home_id) ?? "",
    }));

    return FormatResponse(200, {
      message: "Fetched all broadcasts successfully",
      broadcasts: allBroadcasts,
    });
  } catch (error) {
    console.error(
      `{api: '/get-all-broadcasts', error: ${JSON.stringify(error)}}`
    );

    return FormatResponse(500, {
      message: "Failed to fetch all broadcasts",
      error: error as Error,
    });
  }
};
