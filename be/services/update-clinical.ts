import { FormatResponse } from '../utils/response-formatter';
import { ClinicalDAL } from '../dal/clinical.dal';
import { z } from 'zod';
import { ClinicalSchema } from '../models/Clinical/clinical.model';
import { UsersDAL } from '../dal/users.dal';

const clinicalDal: ClinicalDAL = new ClinicalDAL();
const usersDAL = new UsersDAL();

export const updateClinicalHandler = async (
  userId: string | undefined,
  newClinicalData: z.infer<typeof ClinicalSchema>
) => {
  try {
    if (!userId?.length) {
      return FormatResponse(400, {
        message: 'Update clinical failed',
        error: 'User ID is required',
      });
    }

    // If the userId provided in path params does not match with userId in payload, then throw error
    if (userId != newClinicalData?.userId) {
      return FormatResponse(400, {
        message: 'Update clinical failed',
        error:
          'UserId mismatch - userId provided in path params does not match with the userId in payload',
      });
    }

    // Check if the user already exists in DynamoDB
    const existingUser = await usersDAL.fetchUserById(userId);

    console.info('existing User', JSON.stringify(existingUser, null, 2));

    if (Object.keys(existingUser)?.length == 0) {
      return FormatResponse(404, {
        message: 'Update clinical failed',
        error: `User with user id - ${userId} does not exist`,
      });
    }

    // If the user is soft deleted, return error
    if (existingUser.isDeleted === true) {
      return FormatResponse(404, {
        message: 'Failed to update clinical',
        error: `Cannot update clinical for the user with userId - ${userId} as the record is soft deleted`,
      });
    }

    const validateNewClinicalData = ClinicalSchema.parse(newClinicalData);

    console.info('Validated new clinical data', JSON.stringify(validateNewClinicalData, null, 2));

    const updatedClinical = {
      ...newClinicalData,
      userId: userId,
      modifiedAt: new Date().toISOString(),
    };

    await clinicalDal.updateClinical(updatedClinical);

    return FormatResponse(200, {
      message: `Clinical data updated for user with ID: ${userId}`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error('Validation error: ', JSON.stringify(error.errors, null, 2));
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }
    console.error('Update error:', error);
    return FormatResponse(500, {
      message: 'Update clinical failed',
      error: error,
    });
  }
};
