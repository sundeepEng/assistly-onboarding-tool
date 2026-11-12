import { UsersDAL } from "../../dal/users.dal";
import { z } from "zod";
import { signInSchema } from "../../models/Auth/auth-model";
import { FormatResponse } from "../../utils/response-formatter";

import {
  InitiateAuthCommand,
  AuthFlowType,
} from "@aws-sdk/client-cognito-identity-provider";
import { cognitoClient } from "../../utils/cognito-client";

const usersDAL: UsersDAL = new UsersDAL();

const clientId: string = process.env.USER_POOL_CLIENT_ID!;

export const signInHandler = async (
  signInData: z.infer<typeof signInSchema>
) => {
  const { email, password } = signInData;
  // Check if all fields are provided
  let errorMessage: string = "";

  if (!email || !password) {
    if (!email) {
      errorMessage += "Email, ";
    }
    if (!password) {
      errorMessage += "Password, ";
    }

    return FormatResponse(400, {
      message: "Sign-in failed",
      error: `${errorMessage} is/are required`,
    });
  }

  try {
    const validateSignInData = signInSchema.parse(signInData);
    console.info("validated sign in data", validateSignInData?.email);
    // Check if the email exists in the DynamoDB users table
    const existingUser = await usersDAL.getUserByEmail(email);
    if (!existingUser) {
      return FormatResponse(404, {
        message: "Sign-in failed",
        error: `User with email: ${email} does not exist`,
      });
    }

    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    const response = await cognitoClient.send(command);

    const accessToken = response.AuthenticationResult?.AccessToken;
    const refreshToken = response.AuthenticationResult?.RefreshToken;
    const idToken = response.AuthenticationResult?.IdToken;

    if (!accessToken || !refreshToken || !idToken) {
      return FormatResponse(404, {
        message: "Sign-in failed",
        error: "Tokens not found",
      });
    }

    const loggedInUserId = existingUser[0]?.userId;
    console.info("logged in user Id", loggedInUserId);

    const loggedInUser = existingUser[0];
    const homeId = loggedInUser?.homeId;

    const updateUserLoginTimestamp = await usersDAL.updateUser({
      ...loggedInUser,
      lastLoginTimestamp: new Date().toISOString(),
    });

    console.info(
      `Updated logged in timestamp for userID - ${loggedInUserId}`,
      updateUserLoginTimestamp
    );

    return FormatResponse(
      200,
      { message: "Sign-in successful" },
      {
        idToken: idToken,
        accessToken: accessToken,
        refreshToken: refreshToken,
        userId: loggedInUserId,
        homeId: homeId,
      }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error("Validation error: ", error.errors);
      return FormatResponse(400, {
        message: "Request payload validation failed",
        error: error.errors,
      });
    }

    if (
      (error as Error).name === "NotAuthorizedException" ||
      (error as Error).name === "UserNotFoundException"
    ) {
      return FormatResponse(401, {
        message: "Sign-in failed",
        error: "Incorrect username or password",
      });
    }

    console.error("Sign-in error:", error);
    return FormatResponse(500, {
      message: "Sign-in failed",
      error: error,
    });
  }
};
