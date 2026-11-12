import { UsersDAL } from '../dal/users.dal';
import { v4 as uuidv4 } from 'uuid';

import { FormatResponse } from '../utils/response-formatter';

import { z } from 'zod';
import {
  CreateLeadSchema,
  CreatePCHOOrPCGLeadSchema,
  CreateReferralSchema,
  CreateComplianceGuestSchema,
  CreateNurseOrNurseLeadSchema,
  CreateSalesRepresentativeSchema,
  CreateSalesDirectorSchema,
} from '../models/CRM/user.model';
import { UserTypes } from '../utils/constants';

const usersDAL: UsersDAL = new UsersDAL();

export const createUserHandler = async (
  userData:
    | z.infer<typeof CreatePCHOOrPCGLeadSchema>
    | z.infer<typeof CreateLeadSchema>
    | z.infer<typeof CreateReferralSchema>
    | z.infer<typeof CreateComplianceGuestSchema>
    | z.infer<typeof CreateNurseOrNurseLeadSchema>
    | z.infer<typeof CreateSalesRepresentativeSchema>
    | z.infer<typeof CreateSalesDirectorSchema>
) => {
  try {
    // Insert the user in DynamoDB
    const updatedUserData = {
      userId: uuidv4(),
      ...userData,
      createdAt: new Date().toISOString(),
    };

    //Validate the user data based on the role
    let validatedUserData;

    switch (userData?.role) {
      case UserTypes.PCHO:
        validatedUserData = CreatePCHOOrPCGLeadSchema.parse(updatedUserData);
        break;
      case UserTypes.PCGLEAD:
        validatedUserData = CreatePCHOOrPCGLeadSchema.parse(updatedUserData);
        break;
      case UserTypes.LEAD:
        validatedUserData = CreateLeadSchema.parse(updatedUserData);
        break;
      case UserTypes.REFERRAL:
        validatedUserData = CreateReferralSchema.parse(updatedUserData);
        break;
      case UserTypes.COMPLIANCEGUEST:
        validatedUserData = CreateComplianceGuestSchema.parse(updatedUserData);
        break;
      case UserTypes.NURSE:
        validatedUserData = CreateNurseOrNurseLeadSchema.parse(updatedUserData);
        break;
      case UserTypes.NURSELEAD:
        validatedUserData = CreateNurseOrNurseLeadSchema.parse(updatedUserData);
        break;
      case UserTypes.SALESREPRESENTATIVE:
        validatedUserData = CreateSalesRepresentativeSchema.parse(updatedUserData);
        break;
      case UserTypes.SALESDIRECTOR:
        validatedUserData = CreateSalesDirectorSchema.parse(updatedUserData);
        break;
      default:
        return FormatResponse(400, {
          message: 'User creation failed',
          error: `Invalid role - ${userData?.role}`,
        });
    }

    console.info('Validated create user data:', validatedUserData);

    const { homeId, role, email } = validatedUserData;

    if (
      (role === UserTypes.NURSE || role === UserTypes.NURSELEAD) &&
      (!('associatedHomeIds' in updatedUserData) || !(updatedUserData as any).associatedHomeIds)
    ) {
      (updatedUserData as any).associatedHomeIds = [homeId];
    }

    // Check if the user already exists in DynamoDB
    // For Referral role, allow same email in different homes but prevent duplicates in same homeId
    if (email?.length || email != undefined) {
      if (role === UserTypes.REFERRAL) {
        // If this email is already used by any non-referral role in any home, block creating referral
        const existingUsersWithEmail = await usersDAL.getUserByEmail(email);
        const existingNonReferralUser = existingUsersWithEmail.find(
          (existingUser: any) => existingUser?.role && existingUser.role !== UserTypes.REFERRAL
        );

        if (existingNonReferralUser) {
          return FormatResponse(409, {
            message: 'User creation failed',
            error: `User with email - ${email} already exists with role - ${existingNonReferralUser.role}`,
          });
        }

        // For referrals, check if the same email already exists in the same homeId
        const existingReferralInHome = await usersDAL.getReferralByEmailAndHomeId(email, homeId);
        if (existingReferralInHome?.length > 0) {
          return FormatResponse(409, {
            message: 'User creation failed',
            error: `Referral with email - ${email} already exists in home`,
          });
        }
      } else {
        // For other roles, check if email already exists globally
        const existingUser = await usersDAL.getUserByEmail(email);
        if (existingUser?.length > 0) {
          if (role === UserTypes.NURSE || role === UserTypes.NURSELEAD) {
            const existingUserData = existingUser[0];

            if (
              existingUserData?.role !== UserTypes.NURSE &&
              existingUserData?.role !== UserTypes.NURSELEAD
            ) {
              return FormatResponse(409, {
                message: 'User creation failed',
                error: `User with email - ${email} already exists`,
              });
            }

            const updatedExistingUser = {
              ...existingUserData,
              associatedHomeIds: Array.from(
                new Set([...(existingUserData.associatedHomeIds || []), homeId])
              ),
              modifiedAt: new Date().toISOString(),
            };

            await usersDAL.updateUser(updatedExistingUser);

            return FormatResponse(200, {
              message: 'Updated Home association for existing user',
            });
          }

          return FormatResponse(409, {
            message: 'User creation failed',
            error: `User with email - ${email} already exists`,
          });
        }
      }
    }

    await usersDAL.insertUser(updatedUserData);

    return FormatResponse(201, {
      message: `User created successfully with ID: ${updatedUserData?.userId}`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }
    console.error('Create user error', error);
    return FormatResponse(500, {
      message: 'User creation failed',
      error: error,
    });
  }
};
