import { ForgotPasswordCommand } from "@aws-sdk/client-cognito-identity-provider";

import { FormatResponse } from "../utils/response-formatter";
import { ResetPasswordSchema } from "../models/Auth/auth-model";
import { z } from "zod";
import { cognitoClient } from "../utils/cognito-client";

export const resetPasswordHandler = async (requestPayload: any) => {
  const { email } = requestPayload;

  try {
    const validatedData = ResetPasswordSchema.parse(requestPayload);

    console.info("validated request payload for reset password", validatedData);

    const command = new ForgotPasswordCommand({
      ClientId: process.env.USER_POOL_CLIENT_ID!,
      Username: email,
    });

    await cognitoClient.send(command);

    return FormatResponse(200, {
      message: `OTP sent successfully to email - ${email}`,
    });
  } catch (error: any) {
    console.error("Reset Password Error:", JSON.stringify(error as Error));

    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: "Request payload validation failed",
        error: error.errors,
      });
    }

    if ((error as Error).name === "UserNotFoundException") {
      return FormatResponse(404, {
        message: "Failed to send OTP",
        error: "Email not found",
      });
    }

    if ((error as Error).name === "TooManyRequestsException") {
      return FormatResponse(429, {
        message: "Failed to send OTP",
        error: "Too many requests, please try after some time",
      });
    }

    if ((error as Error).name === "LimitExceededException") {
      return FormatResponse(429, {
        message: "Failed to send OTP",
        error: "Too many incorrect attempts, please try after some time",
      });
    }

    if ((error as Error).name === "CodeDeliveryFailureException") {
      return FormatResponse(500, {
        message: "Failed to send OTP",
        error: "Server Error - Error in sending OTP",
      });
    }

    if ((error as Error).name === "InternalErrorException") {
      return FormatResponse(500, {
        message: "Failed to send OTP",
        error: "Server Error - Cognito encountered an internal error",
      });
    }

    return FormatResponse(500, {
      message: "Failed to send OTP",
      error: error,
    });
  }
};
