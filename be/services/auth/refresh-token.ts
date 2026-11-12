import { z } from "zod";
import { refreshTokenSchema } from "../../models/Auth/auth-model";
import { FormatResponse } from "../../utils/response-formatter";

import { AdminInitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { cognitoClient } from "../../utils/cognito-client";

const clientId: string = process.env.USER_POOL_CLIENT_ID!;
const userPoolId: string = process.env.USER_POOL_ID!;

export const refreshTokenHandler = async (
  requestPayload: z.infer<typeof refreshTokenSchema>
) => {
  try {
    const { refreshToken } = requestPayload;

    refreshTokenSchema.parse(requestPayload);

    console.info("validated refresh token payload");

    const command = new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      ClientId: clientId,
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const response = await cognitoClient.send(command);

    const accessToken = response.AuthenticationResult?.AccessToken;
    const idToken = response.AuthenticationResult?.IdToken;

    if (!accessToken || !idToken) {
      console.info(
        `Tokens not found in response`,
        response.AuthenticationResult
      );

      return FormatResponse(404, {
        message: "Sign-in failed",
        error: "Tokens not found",
      });
    }

    console.info(`Tokens re-issued successfully`);

    return FormatResponse(
      201,
      { message: "Tokens re-issued successfully" },
      {
        idToken: idToken,
        accessToken: accessToken
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

    console.error("Sign-in error:", error);
    return FormatResponse(500, {
      message: "Sign-in failed",
      error: error,
    });
  }
};
