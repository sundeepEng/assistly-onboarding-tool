import { z } from "zod";
import { TeamRoasterDAL } from "../../dal/team-roaster.dal";
import { FormatResponse } from "../../utils/response-formatter";
import { TeamRoasterSchema } from "../../models/HCM/team-roaster.model";

const teamRoasterDAL: TeamRoasterDAL = new TeamRoasterDAL();

export const getTeamRoasterHandler = async (
  filters?: Partial<z.infer<typeof TeamRoasterSchema>>
) => {
  try {
    const roaster = await teamRoasterDAL.getTeamRoaster(filters);

    return FormatResponse(200, {
      message: "Successfully fetched team roaster",
      roasters: roaster,
    });
  } catch (err) {
    console.error(`{api: '/hcm/roaster', error: ${err}}`);

    return FormatResponse(500, {
      message: "Failed to fetch team roaster",
      error: err,
    });
  }
};
