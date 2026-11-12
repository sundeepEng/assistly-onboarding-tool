import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";

import { FormatResponse } from "../utils/response-formatter";
import { ConfirmResetPasswordSchema } from "../models/Auth/auth-model";
import { z } from "zod";
import { cognitoClient } from "../utils/cognito-client";

export const confirmResetPasswordHandler = async (requestPayload: any) => {
  const {
    email,
    newPassword,
    confirmationCode,
  }: { email: string; newPassword: string; confirmationCode: string } =
    requestPayload;

  try {
    const validatedData = ConfirmResetPasswordSchema.parse(requestPayload);

    console.info(
      "Validated request payload for confirm reset password",
      validatedData.email
    );

    const command = new ConfirmForgotPasswordCommand({
      ClientId: process.env.USER_POOL_CLIENT_ID!,
      ConfirmationCode: confirmationCode,
      Username: email,
      Password: newPassword,
    });

    await cognitoClient.send(command);

    return FormatResponse(202, {
      message: "Password updated successfully",
    });
  } catch (error: any) {
    console.error("Failed to reset password", JSON.stringify(error as Error));

    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: "Request payload validation failed",
        error: error.errors,
      });
    }

    if ((error as Error).name === "CodeMismatchException") {
      return FormatResponse(401, {
        message: "Failed to reset password",
        error: "Incorrect OTP",
      });
    }

    if ((error as Error).name === "ExpiredCodeException") {
      return FormatResponse(403, {
        message: "Failed to reset password",
        error: "OTP has expired",
      });
    }

    if ((error as Error).name === "UserNotFoundException") {
      return FormatResponse(404, {
        message: "Failed to send OTP",
        error: "Email not found",
      });
    }

    if ((error as Error).name === "TooManyFailedAttemptsException") {
      return FormatResponse(429, {
        message: "Failed to send OTP",
        error: "Too many incorrect attempts, please try after some time",
      });
    }

    if ((error as Error).name === "TooManyRequestsException") {
      return FormatResponse(429, {
        message: "Failed to send OTP",
        error: "Too many requests, please try after some time",
      });
    }

    return FormatResponse(500, {
      message: "Failed to reset password",
      error: error.message,
    });
  }
};
