import { FormatResponse } from '../utils/response-formatter';
import { UsersDAL } from '../dal/users.dal';
import { Milestones, UserTypes } from '../utils/constants';
import { ClinicalDAL } from '../dal/clinical.dal';
import { getAllUsersSchema } from '../models/CRM/user.model';
import { z } from 'zod';
import { TeamRoasterDAL } from '../dal/team-roaster.dal';
import { HomeDAL } from '../dal/home.dal';

const usersDAL: UsersDAL = new UsersDAL();
const clinicalDAL: ClinicalDAL = new ClinicalDAL();
const teamRoasterDAL: TeamRoasterDAL = new TeamRoasterDAL();
const homeDAL: HomeDAL = new HomeDAL();

export const getAllUsersHandler = async (queryParameters: any) => {
  if (!queryParameters) {
    return FormatResponse(400, {
      message: 'Failed to fetch all users',
      error: 'No query parameters provided',
    });
  }

  const userType = queryParameters?.userType;
  const home = queryParameters?.home;
  const milestone = queryParameters?.milestone;

  if (!userType) {
    return FormatResponse(400, {
      message: 'Failed to fetch all users',
      error: 'userType is required as query parameter',
    });
  }
  // } else if (!home) {
  //   return FormatResponse(400, {
  //     message: "Failed to fetch all users",
  //     error: "home is required as query parameter",
  //   });
  // }

  try {
    getAllUsersSchema.parse(queryParameters);
    let homeId = queryParameters?.homeId;

    if (!homeId && home) {
      const homeRecord = await homeDAL.getByHomeName(home);
      if (homeRecord?.homeId) {
        homeId = homeRecord.homeId;
      }
    }

    let fetchUsersFromDB = homeId
      ? await usersDAL.fetchAllUsersWithHomeId(userType, homeId)
      : await usersDAL.fetchAllUsers(userType, home);

    const supportsAssociatedHomeMerge =
      userType === UserTypes.HOMEADMIN ||
      userType === UserTypes.PCHO ||
      userType === UserTypes.NURSE ||
      userType === UserTypes.NURSELEAD;

    if (
      homeId &&
      supportsAssociatedHomeMerge &&
      (!fetchUsersFromDB || fetchUsersFromDB.length === 0)
    ) {
      const allRoleUsers = await usersDAL.fetchAllUsersByRole(userType);
      fetchUsersFromDB = allRoleUsers.filter((u: any) => u?.homeId === homeId);
    }

    console.info('homeId', homeId, userType);
    if (homeId && supportsAssociatedHomeMerge) {
      const usersByAssociatedHomeId = await fetchUsersByAssociatedHomeIdFromDecryptedRecords(
        userType,
        homeId
      );

      console.info('usersByAssociatedHomeId', usersByAssociatedHomeId);

      const usersById = new Map<string, any>();
      [...fetchUsersFromDB, ...usersByAssociatedHomeId].forEach((user) => {
        if (user?.userId) {
          usersById.set(user.userId, user);
        }
      });

      fetchUsersFromDB = Array.from(usersById.values());
    }
    if (userType === UserTypes.PCG || userType === UserTypes.HOMEADMIN) {
      fetchUsersFromDB = await Promise.all(
        fetchUsersFromDB.map(async (user) => {
          const roasterData = await teamRoasterDAL.getTeamRoaster({
            user_id: user?.userId,
          });
          user = { ...user, ...{ roaster: roasterData } };
          return user;
        })
      );
    }
    fetchUsersFromDB = fetchUsersFromDB.sort((a, b) => b?.createdAt.localeCompare(a?.createdAt));

    // Transform associatedUserIds for Nurse, NurseLead, and SalesDirector users
    if (
      userType === UserTypes.NURSE ||
      userType === UserTypes.NURSELEAD ||
      userType === UserTypes.SALESDIRECTOR ||
      userType === UserTypes.PCHO
    ) {
      fetchUsersFromDB = await transformAssociatedUserIds(fetchUsersFromDB);
    }

    if (milestone) {
      fetchUsersFromDB = fetchUsersFromDB.filter((user) => user?.milestone?.includes(milestone));
      if (milestone == Milestones.contract) {
        fetchUsersFromDB = await Promise.all(
          fetchUsersFromDB.map(async (user) => {
            const clinicalData = await clinicalDAL.fetchClinicalByUserId(user.userId);
            user = { ...user, ...{ clinical: clinicalData } };
            return user;
          })
        );
      }
    }

    if (queryParameters?.isReferredByUserId) {
      const referredByIds = Array.isArray(queryParameters.isReferredByUserId)
        ? queryParameters.isReferredByUserId
        : [queryParameters.isReferredByUserId];
      fetchUsersFromDB = fetchUsersFromDB.filter((user) =>
        referredByIds.includes(user?.isReferredByUserId)
      );
    }

    fetchUsersFromDB = await resolveReferredByUserNames(fetchUsersFromDB);

    return FormatResponse(200, {
      users: fetchUsersFromDB,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }
    return FormatResponse(500, {
      message: 'Failed to fetch all users',
      error: error,
    });
  }
};

/**
 * Resolves isReferredByUserId to isReferredByUserName for each user that has it
 */
const resolveReferredByUserNames = async (users: any[]) => {
  const referredByIds = new Set<string>();

  users.forEach((user) => {
    if (user?.isReferredByUserId) {
      referredByIds.add(user.isReferredByUserId);
    }
  });

  if (referredByIds.size === 0) return users;

  const referredByUsers = await usersDAL.batchFetchUsersByIds(Array.from(referredByIds));

  const userMap = new Map<string, string>();
  referredByUsers.forEach((u) => {
    if (u.userId && u.name) {
      userMap.set(u.userId, u.name);
    }
  });

  return users.map((user) => {
    if (user?.isReferredByUserId) {
      return { ...user, isReferredByUserName: userMap.get(user.isReferredByUserId) || '' };
    }
    return user;
  });
};

/**
 * Transforms associatedUserIds array to array of objects with userId and userName
 * Optimized to batch fetch all user names in a single database call
 */
const transformAssociatedUserIds = async (users: any[]) => {
  // Collect all unique associated user IDs from all nurse/nurse lead users
  const allAssociatedIds = new Set<string>();

  users.forEach((user) => {
    if (
      user?.associatedUserIds &&
      Array.isArray(user.associatedUserIds) &&
      Array.from(user.associatedUserIds).length > 0
    ) {
      user.associatedUserIds.forEach((id: string) => allAssociatedIds.add(id));
    }
  });

  if (allAssociatedIds.size === 0) {
    return users; // No associated users to fetch
  }

  // Batch fetch all associated users in a single call
  const associatedUsers = await usersDAL.batchFetchUsersByIds(Array.from(allAssociatedIds));

  // Create a map for quick lookup: userId -> userName
  const userMap = new Map<string, string>();
  associatedUsers.forEach((associatedUser) => {
    if (associatedUser.userId && associatedUser.name) {
      userMap.set(associatedUser.userId, associatedUser.name);
    }
  });

  // Transform each user's associatedUserIds
  return users.map((user) => {
    if (user.associatedUserIds && Array.isArray(user.associatedUserIds)) {
      user.associatedUserIds = user.associatedUserIds.map((userId: string) => ({
        userId: userId,
        userName: userMap.get(userId) || '', // Fallback for missing names
      }));
    }
    return user;
  });
};

const fetchUsersByAssociatedHomeIdFromDecryptedRecords = async (role: string, homeId: string) => {
  const allRoleUsers = await usersDAL.fetchAllUsersByRole(role);

  console.info('allRoleUsers for role before filter:', role, ':', allRoleUsers);
  return allRoleUsers.filter((user: any) => {
    const associatedHomeIds = user?.associatedHomeIds;
    return Array.isArray(associatedHomeIds) && associatedHomeIds.includes(homeId);
  });
};
