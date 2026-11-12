import { z } from "zod";
import { TeamRoasterSchema } from "../../models/HCM/team-roaster.model";
import { TeamRoasterDAL } from "../../dal/team-roaster.dal";
import { FormatResponse } from "../../utils/response-formatter";
import { UsersDAL } from "../../dal/users.dal";

const usersDAL: UsersDAL = new UsersDAL();
const teamRoasterDAL: TeamRoasterDAL = new TeamRoasterDAL();

export const upsertTeamRoasterHandler = async (
  roasterData: z.infer<typeof TeamRoasterSchema>
) => {
  if (!roasterData) {
    console.error(`{api: '/hcm/roaster', error: No body provided}`);

    return FormatResponse(400, {
      message: "Failed to upsert team roaster",
      error: "No body provided",
    });
  }

  // Check if the user with Id exists in the users table
  const existingUser = await usersDAL.fetchUserById(roasterData?.user_id);
  if (Object.keys(existingUser)?.length == 0) {
    console.error(
      `{api: '/hcm/roaster', error: User not found with ID: ${roasterData?.user_id}}`
    );

    return FormatResponse(400, {
      message: "Failed to upsert team roaster",
      error: `User with userID - ${roasterData?.user_id} not found`,
    });
  }

  // If the user is soft deleted, return error
  if (existingUser.isDeleted === true) {
    return FormatResponse(403, {
      message: "Failed to upsert team roaster",
      error: `Cannot upsert roaster for the user with userId - ${roasterData.user_id} as the record is soft deleted`,
    });
  }

  try {
    const validatedData = TeamRoasterSchema.parse(roasterData);
    const newRoaster = await teamRoasterDAL.UpsertTeamRoaster(validatedData);

    return FormatResponse(200, {
      message: "Successfully upserted team roaster",
      data: newRoaster,
    });
  } catch (err) {
    console.error(`{api: '/hcm/roaster', error: ${err}}`);

    return FormatResponse(500, {
      message: "Failed to upsert team roaster",
      error: err,
    });
  }
};
