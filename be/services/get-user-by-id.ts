import { ClinicalDAL } from '../dal/clinical.dal';
import { HomeDAL } from '../dal/home.dal';
import { TeamRoasterDAL } from '../dal/team-roaster.dal';
import { UsersDAL } from '../dal/users.dal';
import { Milestones } from '../utils/constants';
import { FormatResponse } from '../utils/response-formatter';

const usersDAL: UsersDAL = new UsersDAL();
const clinicalDAL: ClinicalDAL = new ClinicalDAL();
const teamRoasterDAL: TeamRoasterDAL = new TeamRoasterDAL();
const homeDAL: HomeDAL = new HomeDAL();

export const getUserByIdHandler = async (userId: string | undefined) => {
  if (!userId?.length) {
    return FormatResponse(400, { message: 'User ID is required' });
  }
  try {
    // Check if the user already exists in DynamoDB
    let existingUser = await usersDAL.fetchUserById(userId);

    console.info('existing User', existingUser);

    if (Object.keys(existingUser)?.length == 0) {
      return FormatResponse(404, {
        message: 'Failed to fetch details of the user',
        error: `User with user id - ${userId} does not exist`,
      });
    }

    // If the user is a Senior, then fetch clinical data and append to the result
    if (existingUser?.milestone?.length && existingUser?.milestone.includes(Milestones.contract)) {
      const clinicalData = await clinicalDAL.fetchClinicalByUserId(userId);
      existingUser = { ...existingUser, clinical: clinicalData };
    }

    // If the user is a PCG or HomeAdmin, then fetch team roaster data and append to the result
    if (existingUser?.role === 'PCG' || existingUser?.role === 'HomeAdmin') {
      const roasterData = await teamRoasterDAL.getTeamRoaster({
        user_id: existingUser?.userId,
      });
      existingUser = { ...existingUser, ...{ roaster: roasterData } };
    }

    if (
      ['PCHO', 'HomeAdmin', 'PCGLead', 'PCG', 'NurseLead', 'Nurse'].includes(existingUser?.role) &&
      Array.isArray(existingUser.associatedHomeIds) &&
      existingUser.associatedHomeIds.length > 0
    ) {
      const homeRecords = await homeDAL.batchFetchHomesByIds(existingUser.associatedHomeIds);

      const associatedHomes = homeRecords.map((home) => ({
        homeId: home.homeId,
        home: home.homeName,
      }));

      existingUser = {
        ...existingUser,
        associatedHomes: associatedHomes,
      };
    }

    return FormatResponse(200, { user: existingUser });
  } catch (error) {
    return FormatResponse(500, {
      message: 'Failed to fetch details of the user',
      error: error,
    });
  }
};
