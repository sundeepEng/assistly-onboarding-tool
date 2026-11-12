import { FormatResponse } from '../utils/response-formatter';
import { UsersDAL } from '../dal/users.dal';
import { z } from 'zod';
import { DEFAULT_HOME_CAPACITY, HomeTypes, UserTypes } from '../utils/constants';
import { cognitoClient } from '../utils/cognito-client';
import {
  AdminUpdateUserAttributesCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  UpdateLeadOrSeniorSchema,
  UpdateHomeAdminSchema,
  UpdatePCHOOrPCGLeadOrPCGSchema,
  UpdateReferralSchema,
  UpdateComplianceGuestSchema,
  UpdateNurseOrNurseLeadSchema,
  UpdateSalesRepresentativeSchema,
  UpdateSalesDirectorSchema,
} from '../models/CRM/user.model';
import { HomeDAL } from '../dal/home.dal';
import { getCoordinates } from '../utils/geocoding';

const usersDAL: UsersDAL = new UsersDAL();
const homeDAL: HomeDAL = new HomeDAL();

export const updateUserHandler = async (
  userId: string | undefined,
  newUserData:
    | z.infer<typeof UpdatePCHOOrPCGLeadOrPCGSchema>
    | z.infer<typeof UpdateHomeAdminSchema>
    | z.infer<typeof UpdateLeadOrSeniorSchema>
    | z.infer<typeof UpdateReferralSchema>
    | z.infer<typeof UpdateComplianceGuestSchema>
    | z.infer<typeof UpdateSalesRepresentativeSchema>
    | z.infer<typeof UpdateSalesDirectorSchema>
) => {
  try {
    const validateReferralEmailUpdate = async (email: string, homeId: string) => {
      const existingUsersWithEmail = await usersDAL.getUserByEmail(email);
      const existingNonReferralUser = existingUsersWithEmail.find(
        (u: any) => u?.role && u.role !== UserTypes.REFERRAL
      );

      if (existingNonReferralUser) {
        return FormatResponse(409, {
          message: 'Update user failed',
          error: `User with email - ${email} already exists with role - ${existingNonReferralUser.role}`,
        });
      }

      const existingReferralInHome = await usersDAL.getReferralByEmailAndHomeId(email, homeId);
      const duplicateReferralInHome = existingReferralInHome?.find(
        (u: any) => u?.userId && u.userId !== userId
      );

      if (duplicateReferralInHome) {
        return FormatResponse(409, {
          message: 'Update user failed',
          error: `Referral with email - ${email} already exists in home`,
        });
      }

      return null;
    };

    // If userId is not provided, throw error
    if (!userId?.length) {
      return FormatResponse(400, {
        message: 'Update user failed',
        error: 'userId should not be empty',
      });
    }

    //If the userId provided in path params does not match with userId in payload, then throw error
    if (userId != newUserData?.userId) {
      return FormatResponse(400, {
        message: 'Update user failed',
        error:
          'UserId mismatch - userId provided in path params does not match with the userId in payload',
      });
    }

    // Check if the user with userID exists in the DB
    const existingUser = await usersDAL.fetchUserById(userId);

    //Check if the user with userId exists in DB
    if (Object.keys(existingUser)?.length == 0) {
      return FormatResponse(404, {
        message: 'Update user failed',
        error: `User with user id - ${userId} does not exist`,
      });
    }

    //Check for duplicate email if the email is provided in the payload
    if (newUserData?.email?.length && (!existingUser?.email || existingUser?.email == '')) {
      if (newUserData?.role === UserTypes.REFERRAL) {
        const validationError = await validateReferralEmailUpdate(
          newUserData.email,
          newUserData.homeId
        );
        if (validationError) return validationError;
      } else {
        const existingUser = await usersDAL.getUserByEmail(newUserData.email);
        if (existingUser?.length > 0) {
          return FormatResponse(409, {
            message: 'User creation failed',
            error: `User with email - ${newUserData.email} already exists`,
          });
        }
      }
    }
    console.info(
      `{api: "/update-user", path: "/update-user/${userId}" log: "Existing User:" ${existingUser}}`
    );

    //The email is non editable for all roles except Referral.
    //If the user tries to update email for other roles, throw error.
    if (
      existingUser?.email?.length &&
      existingUser?.email != newUserData?.email &&
      newUserData?.role !== UserTypes.REFERRAL
    ) {
      return FormatResponse(400, {
        message: 'Update user failed',
        error: 'Email Mismatch - Provided email does not match with the existing email.',
      });
    }

    //For Referral role, allow email update but enforce validation rules
    if (
      newUserData?.role === UserTypes.REFERRAL &&
      newUserData?.email?.length &&
      existingUser?.email != newUserData?.email
    ) {
      const validationError = await validateReferralEmailUpdate(
        newUserData.email,
        newUserData.homeId
      );
      if (validationError) return validationError;
    }

    let updatedUser: any = {
      ...newUserData,
      userId: userId,
      createdAt: existingUser?.createdAt,
      modifiedAt: new Date().toISOString(),
      ...(existingUser?.lastLoginTimestamp && existingUser.lastLoginTimestamp !== ''
        ? { lastLoginTimestamp: existingUser.lastLoginTimestamp }
        : {}),
    };

    const homeDetails = await homeDAL.getHomeById(newUserData.homeId);

    const effectiveCapacity =
      typeof homeDetails?.homeCapacity === 'number'
        ? homeDetails.homeCapacity
        : DEFAULT_HOME_CAPACITY;

    const isSeniorClinicalConversion =
      existingUser?.role === UserTypes.LEAD &&
      newUserData?.role === UserTypes.SENIOR &&
      'milestone' in newUserData &&
      'milestone' in existingUser &&
      !existingUser?.milestone?.includes('contract') &&
      newUserData?.milestone?.includes('contract');

    if (isSeniorClinicalConversion) {
      const activeCount = await usersDAL.countActiveUsersByHomeAndRole(
        UserTypes.SENIOR,
        newUserData.homeId
      );
      if (activeCount >= effectiveCapacity) {
        return FormatResponse(409, {
          message: 'Update user failed',
          error: `Unable to move to Clinical\nThis home has reached its Senior capacity. It currently has ${activeCount} of ${effectiveCapacity} active seniors.`,
        });
      }
    }

    if (
      Object.keys(homeDetails).length > 0 &&
      homeDetails?.homeType &&
      homeDetails.homeType === HomeTypes.IN_HOME_CARE &&
      (updatedUser.role === UserTypes.SENIOR || updatedUser.role === UserTypes.LEAD)
    ) {
      console.info('Home is', HomeTypes.IN_HOME_CARE, 'Getting Coordinates');

      const { address } =
        (newUserData as z.infer<typeof UpdateLeadOrSeniorSchema>)?.biography?.personalDetails || {};

      console.info('Address:', address);

      const { latitude, longitude } = await getCoordinates({
        street: address?.street1 + ' ' + address?.street2,
        city: address?.city,
        state: address?.state,
        zipCode: address?.zipCode,
      });

      console.info('Coordinates:', { latitude, longitude });

      updatedUser = {
        ...updatedUser,
        latitude: latitude,
        longitude: longitude,
      };
    }

    let validateNewUserData;

    switch (newUserData?.role) {
      case UserTypes.PCHO:
        validateNewUserData = UpdatePCHOOrPCGLeadOrPCGSchema.parse(updatedUser);
        break;
      case UserTypes.PCGLEAD:
        validateNewUserData = UpdatePCHOOrPCGLeadOrPCGSchema.parse(updatedUser);
        break;
      case UserTypes.PCG:
        validateNewUserData = UpdatePCHOOrPCGLeadOrPCGSchema.parse(updatedUser);
        break;
      case UserTypes.HOMEADMIN:
        validateNewUserData = UpdateHomeAdminSchema.parse(updatedUser);
        break;
      case UserTypes.SENIOR:
        validateNewUserData = UpdateLeadOrSeniorSchema.parse(updatedUser);
        break;
      case UserTypes.LEAD:
        validateNewUserData = UpdateLeadOrSeniorSchema.parse(updatedUser);
        break;
      case UserTypes.REFERRAL:
        validateNewUserData = UpdateReferralSchema.parse(updatedUser);
        break;
      case UserTypes.COMPLIANCEGUEST:
        validateNewUserData = UpdateComplianceGuestSchema.parse(updatedUser);
        break;
      case UserTypes.NURSE:
        validateNewUserData = UpdateNurseOrNurseLeadSchema.parse(updatedUser);
        break;
      case UserTypes.NURSELEAD:
        validateNewUserData = UpdateNurseOrNurseLeadSchema.parse(updatedUser);
        break;
      case UserTypes.SALESREPRESENTATIVE:
        validateNewUserData = UpdateSalesRepresentativeSchema.parse(updatedUser);
        break;
      case UserTypes.SALESDIRECTOR:
        validateNewUserData = UpdateSalesDirectorSchema.parse(updatedUser);
        break;
      default:
        return FormatResponse(400, {
          message: 'Update user failed',
          error: `Invalid role - ${newUserData?.role}`,
        });
    }

    console.info('Validated new user data', validateNewUserData);

    await usersDAL.updateUser(validateNewUserData);

    console.info('User updated successfully');

    if (
      newUserData?.role == UserTypes.SENIOR ||
      newUserData?.role == UserTypes.PCG ||
      newUserData?.role == UserTypes.NURSE
    ) {
      // Check if the update call is to complete the contract of the Lead/PCG. If yes, update the role in the cognito as well
      const isSeniorContractCompletion =
        existingUser?.role === UserTypes.LEAD &&
        newUserData?.role === UserTypes.SENIOR &&
        'milestone' in newUserData &&
        'milestone' in existingUser &&
        !existingUser?.milestone?.includes('contract') &&
        newUserData?.milestone?.includes('contract');

      const isPCGContractCompletion =
        existingUser?.role === UserTypes.PCGLEAD && newUserData?.role === UserTypes.PCG;

      const isNurseContractCompletion =
        existingUser?.role === UserTypes.NURSELEAD && newUserData?.role === UserTypes.NURSE;

      const shouldUpdateCognitoRole =
        isSeniorContractCompletion || isPCGContractCompletion || isNurseContractCompletion;

      if (shouldUpdateCognitoRole) {
        const cognitoUserExists = await getCognitoUserByEmail(existingUser?.email);
        if (cognitoUserExists) {
          try {
            const input = {
              UserPoolId: process.env.USER_POOL_ID,
              Username: existingUser?.email,
              UserAttributes: [
                {
                  Name: 'custom:role',
                  Value: newUserData?.role,
                },
              ],
            };

            const command = new AdminUpdateUserAttributesCommand(input);

            const response = await cognitoClient.send(command);
            console.info(
              `{api: "/update-user", path: "/update-user/${userId}" log: "Cognito update role response:" ${response}}`
            );
          } catch (err) {
            return FormatResponse(500, {
              message: "Update user failed - Couldn't complete contract",
              error: err,
            });
          }
        }
      }
    }

    return FormatResponse(200, {
      message: `User updated successfully with ID: ${userId}`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error('Validation error: ', error.errors);
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }
    console.error('Update error:', error);
    return FormatResponse(500, {
      message: 'Update user failed',
      error: error.message,
    });
  }
};

export const getCognitoUserByEmail = async (email: string) => {
  try {
    const input = {
      UserPoolId: process.env.USER_POOL_ID!,
      Username: email,
    };

    const command = new AdminGetUserCommand(input);

    const response = await cognitoClient.send(command);

    return Object.keys(response)?.length > 0;
  } catch (err: any) {
    console.info(`{api: "/update-user", log: "Cognito get user error:" ${err}}`);
    return false;
  }
};
