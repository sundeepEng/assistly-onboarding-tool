/**
 * Token factories — build the unsigned JWTs the app can decode.
 *
 * `decodeJwtToken` (utils/auth.ts) only base64-decodes the payload, so the
 * signature is never verified — but the claims must match:
 *   - "custom:role" is the claim `getUserRoleFromToken` reads
 *   - "exp" must be in the future or `checkAndCleanExpiredTokens` wipes the
 *     session the moment the app boots
 */

import { AppRole, TEST_HOME_ID, TEST_USER_ID } from "../constants";

// Real JWT segments are unpadded base64url, so drop the `=` btoa adds — both
// `atob` (utils/auth.ts) and `decodeMockJwt` decode the unpadded form fine.
const b64url = (obj: Record<string, unknown>) =>
  btoa(JSON.stringify(obj))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const buildMockIdToken = (
  role: AppRole = "PCHO",
  { email = "testuser@assistly.com", exp = 9999999999 } = {}
) =>
  [
    b64url({ alg: "HS256", typ: "JWT" }),
    b64url({
      email,
      "custom:role": role,
      "cognito:username": email,
      iat: 1600000000,
      exp,
    }),
    "test-signature",
  ].join(".");

/** Reverse of `buildMockIdToken` — reads the claims back out of an unsigned JWT. */
export const decodeMockJwt = (token: string): Record<string, any> =>
  JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));

/**
 * Response shape `authenticateUser` (services/authenticate-user.ts) expects
 * before it will persist cookies. The API returns the id token at the top
 * level as well as inside `cookies` (both carry the same token), plus the
 * authenticated user's type.
 */
export const buildSigninResponse = (role: AppRole = "PCHO") => {
  const idToken = buildMockIdToken(role);
  return {
    idToken,
    userType: role,
    cookies: {
      idToken,
      accessToken: "mock-access-token",
      userId: TEST_USER_ID,
      homeId: TEST_HOME_ID,
    },
  };
};
