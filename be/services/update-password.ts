import { FormatResponse } from "../utils/response-formatter";
import { ChangePasswordCommand } from "@aws-sdk/client-cognito-identity-provider";
import { z } from "zod";
import { updatePasswordSchema } from "../models/Auth/auth-model";
import { cognitoClient } from "../utils/cognito-client";

export const updatePasswordHandler = async (
  requestPayload: z.infer<typeof updatePasswordSchema>
) => {
  const { accessToken, oldPassword, newPassword } = requestPayload;

  // Check if all fields are provided
  if (!accessToken || !oldPassword || !newPassword) {
    let errorMessage: string = "";
    switch (true) {
      case !accessToken:
        errorMessage += "accessToken, ";
      case !oldPassword:
        errorMessage += "oldPassword, ";
      case !newPassword:
        errorMessage += "newPassword, ";
      default:
        errorMessage =
          errorMessage.length > 1
            ? errorMessage.slice(0, errorMessage.length - 2)
            : errorMessage;
        break;
    }
    return FormatResponse(400, {
      message: "Failed to update password",
      error: `${errorMessage} is/are required`,
    });
  }

  try {
    const validateData = updatePasswordSchema.parse(requestPayload);
    console.info("Validated data:", validateData);

    // Change the password in Cognito
    const changePasswordCommand = new ChangePasswordCommand({
      AccessToken: accessToken,
      PreviousPassword: oldPassword,
      ProposedPassword: newPassword,
    });
    const response = await cognitoClient.send(changePasswordCommand);

    console.info("Password changed successfully:", response);

    return FormatResponse(200, { message: "Password changed successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Request payload validation failed", error.errors);

      return FormatResponse(400, {
        message: "Request payload validation failed",
        error: error.errors,
      });
    }

    if ((error as Error).name === "NotAuthorizedException") {
      console.error("Incorrect old password", error as Error);

      return FormatResponse(401, {
        message: "Failed to update password",
        error: "Incorrect old password",
      });
    }

    if ((error as Error).name === "LimitExceededException") {
      console.error(
        "Too many incorrect attempts. Please try again later.",
        error as Error
      );

      return FormatResponse(429, {
        message: "Failed to update password",
        error: "Too many incorrect attempts. Please try again later.",
      });
    }

    console.error("Error changing password:", error);

    return FormatResponse(500, {
      message: "Failed to update password",
      error: error,
    });
  }
};
