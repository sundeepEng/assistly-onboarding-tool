/**
 * Session helpers for unit tests.
 *
 * The app reads its session out of cookies via `js-cookie` (utils/auth.ts) and
 * every service reads `idToken` from there to build its Authorization header.
 * These helpers write real cookies into jsdom's `document.cookie` so nothing in
 * the code under test needs to be stubbed.
 */

import Cookies from "js-cookie";
import type { Role } from "../../utils/roles";

export const TEST_HOME_ID = "11111111-1111-4111-8111-111111111111";
export const TEST_USER_ID = "22222222-2222-4222-8222-222222222222";

/** Far-future expiry so `isTokenExpired` reports a live session. */
export const FUTURE_EXP = 9999999999;
/** 2001-09-09 — safely in the past. */
export const PAST_EXP = 1000000000;

const b64url = (obj: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * Build an unsigned JWT the app can decode. `decodeJwtToken` only base64-decodes
 * the payload — the signature is never verified — but the claims must be right:
 *   - "custom:role" is what `getUserRoleFromToken` reads
 *   - "exp" must be in the future or `checkAndCleanExpiredTokens` wipes the session
 */
export const buildIdToken = (
  role: Role | string = "PCHO",
  {
    email = "testuser@assistly.com",
    exp = FUTURE_EXP,
  }: { email?: string; exp?: number } = {}
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

/** Write the four cookies `authenticateUser` persists after a successful sign-in. */
export const setAuthSession = (
  role: Role | string = "PCHO",
  {
    userId = TEST_USER_ID,
    homeId = TEST_HOME_ID,
    exp = FUTURE_EXP,
  }: { userId?: string; homeId?: string; exp?: number } = {}
) => {
  const idToken = buildIdToken(role, { exp });
  Cookies.set("idToken", idToken);
  Cookies.set("accessToken", "test-access-token");
  Cookies.set("userId", userId);
  Cookies.set("homeId", homeId);
  return idToken;
};

/** The response body shape `authenticateUser` requires before it persists cookies. */
export const buildSigninResponse = (role: Role | string = "PCHO") => {
  const idToken = buildIdToken(role);
  return {
    idToken,
    userType: role,
    cookies: {
      idToken,
      accessToken: "test-access-token",
      userId: TEST_USER_ID,
      homeId: TEST_HOME_ID,
    },
  };
};

export const clearAuthSession = () => {
  ["idToken", "accessToken", "userId", "homeId", "role"].forEach((name) =>
    Cookies.remove(name)
  );
  // js-cookie's `remove` only works for cookies it can see; wipe jsdom directly
  // so a cookie written with a different path cannot leak between tests.
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
};

/** The Authorization header every authenticated service is expected to send. */
export const bearer = (token: string) => `Bearer ${token}`;
