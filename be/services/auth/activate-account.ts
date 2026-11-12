/**
 * This is the account activation flow for Lead/Senior/PCGLead/PCG/ComplianceGuest/NurseLead roles
 */

import { UsersDAL } from '../../dal/users.dal';
import { FormatResponse } from '../../utils/response-formatter';
import { SignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { z } from 'zod';
import { AccountActivationSchema } from '../../models/Auth/auth-model';
import { cognitoClient } from '../../utils/cognito-client';
import { UserTypes } from '../../utils/constants';
import jwt from 'jsonwebtoken';
import { getAccountActivationSecret } from '../../utils/account-activation-secret';

const usersDAL = new UsersDAL();

export const accountActivationHandler = async (requestPayload: any) => {
  try {
    // Validate the request payload
    const validatePayload = AccountActivationSchema.parse(requestPayload);

    const { email, password, token } = validatePayload;

    console.info(`Validated account activation payload for ${email}`);

    // Check if the user already exists in DynamoDB
    const existingUser = await usersDAL.getUserByEmail(email);

    if (existingUser?.length == 0) {
      return FormatResponse(409, {
        message: 'Account activation failed',
        error: `User with email - ${email} does not exist. Please use the email which was given at the time of initial contact.`,
      });
    }

    const { role, name } = existingUser[0];

    const accountActivationSecret = await getAccountActivationSecret();

    // Validate the activation token
    let decodedToken: jwt.JwtPayload;
    try {
      decodedToken = jwt.verify(token, accountActivationSecret, {
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;
    } catch (err) {
      return FormatResponse(403, {
        message: 'Account activation failed',
        error: 'Invalid or expired activation link. Please request a new one.',
      });
    }

    if (decodedToken?.purpose !== 'account-activation') {
      return FormatResponse(403, {
        message: 'Account activation failed',
        error: 'Invalid activation token. Please request a new one.',
      });
    }

    if (decodedToken?.email?.toLowerCase() !== email.toLowerCase()) {
      return FormatResponse(403, {
        message: 'Account activation failed',
        error: 'Token email mismatch. Please request a new one.',
      });
    }

    if (role === UserTypes.PCHO) {
      return FormatResponse(409, {
        message: 'Account activation failed',
        error: "Account activation is not valid for PCHO's",
      });
    }

    // Check for password and confirm password match
    if (validatePayload.password !== validatePayload.confirmPassword) {
      return FormatResponse(409, {
        message: 'Account activation failed',
        error: 'Password and Confirm Password do not match',
      });
    }

    const signUpCommand = new SignUpCommand({
      ClientId: process.env.USER_POOL_CLIENT_ID!,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'custom:fullName', Value: name },
        { Name: 'custom:role', Value: role },
      ],
    });

    await cognitoClient.send(signUpCommand);

    return FormatResponse(201, {
      message: `User Account for ${email} is successfully created and activated`,
    });
  } catch (error: any) {
    console.error('Account activation error:', error);
    if (error instanceof z.ZodError) {
      console.error('Validation Errors:', error.errors);
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }

    if ((error as Error).name === 'UsernameExistsException') {
      return FormatResponse(409, {
        message: 'Account activation failed',
        error: `Account already exists for ${requestPayload?.email}. Please Login or use Forgot Password to reset your password.`,
      });
    }
    return FormatResponse(500, {
      message: 'Account activation failed',
      error: error,
    });
  }
};
