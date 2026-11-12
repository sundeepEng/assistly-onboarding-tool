import { z } from 'zod';
import { FormatResponse } from '../utils/response-formatter';
import { UserTypes } from '../utils/constants';
import { UsersDAL } from '../dal/users.dal';
import { deleteUserFiles, deleteUserFromCognito } from '../utils/delete-user-utils';
import { UserShiftsDAL } from '../dal/user-shifts.dal';

const usersDAL: UsersDAL = new UsersDAL();
const userShiftsDAL: UserShiftsDAL = new UserShiftsDAL();

export const deleteUserHandler = async (userId: string | undefined) => {
  if (!userId || !userId?.length) {
    return FormatResponse(404, {
      message: 'Failed to delete user',
      error: 'UserId not found in params',
    });
  }

  try {
    //#region Validations

    //Validate userId
    z.string().uuid().parse(userId);

    //Check if the user exists
    const userDetails = await usersDAL.fetchUserById(userId);

    if (Object.keys(userDetails)?.length === 0) {
      return FormatResponse(404, {
        message: 'Failed to delete user',
        error: `User with userId - ${userId} not found`,
      });
    }

    //#endregion

    const isHardDelete: boolean = [
      UserTypes.LEAD,
      UserTypes.REFERRAL,
      UserTypes.PCGLEAD,
      UserTypes.COMPLIANCEGUEST,
      UserTypes.NURSELEAD,
    ].includes(userDetails.role);

    if (isHardDelete) {
      console.info('Hard delete initiated for the userId', userId);

      // Delete user from DB
      const deletedUser = await usersDAL.deleteUser(userId);

      console.info(`Deleted user in DB:`, JSON.stringify(deletedUser));

      // Delete user files in S3
      await deleteUserFiles(userDetails, process.env.USER_DOCUMENTS_BUCKET_NAME!);
      await deleteUserFiles(userDetails, process.env.MODIFIED_CONTRACTS_BUCKET_NAME!);
      await deleteUserFiles(userDetails, process.env.USER_PROFILE_IMAGES_BUCKET_NAME!);

      console.info(`Deleted user files in S3`);

      // Remove user from cognito pool
      await deleteUserFromCognito(userDetails.email);

      console.info(`Deleted user ${userDetails.userId} from cognito successfully`);

      return FormatResponse(200, {
        message: `Deleted user with userId: ${userId} successfully`,
        data: deletedUser,
      });
    } else {
      console.info('Soft delete initiated for the userId', userId);

      let updatedUserDetails = {
        ...userDetails,
        isDeleted: true,
        deletedOn: new Date().toISOString(),
      };

      // Update DB
      await usersDAL.updateUser(updatedUserDetails);

      console.info(`Soft deleted user ${userDetails.userId} in DB successfully`);

      // Remove user from cognito pool
      await deleteUserFromCognito(userDetails.email);

      console.info(`Soft deleted user ${userDetails.userId} in cognito successfully`);

      if (userDetails.role === UserTypes.PCG) {
        // Delete future shifts for the user
        await userShiftsDAL.deleteShiftsByUserId(
          userDetails.userId,
          new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        );
      }

      return FormatResponse(200, {
        message: `User with userId: ${userId} soft deleted successfully`,
        data: updatedUserDetails,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Failed to delete user',
        error: error.errors,
      });
    }

    return FormatResponse(500, {
      message: 'Failed to delete user',
      error: JSON.stringify(error as Error),
    });
  }
};
