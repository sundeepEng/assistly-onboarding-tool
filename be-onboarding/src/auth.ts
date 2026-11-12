import { CognitoJwtVerifier } from "aws-jwt-verify";

/**
 * Same authentication as the rest of Assistly: Cognito user-pool id tokens,
 * verified against the pool JWKS. The portal sends `Authorization: Bearer
 * <idToken>` — the same credential API Gateway validates for the main API.
 *
 * AUTH_DEV_BYPASS=1 (local development only) decodes claims without verifying
 * so the API can be exercised before Cognito env is configured.
 */
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID || null;
const DEV_BYPASS = process.env.AUTH_DEV_BYPASS === "1";

const verifier = USER_POOL_ID
  ? CognitoJwtVerifier.create({
      userPoolId: USER_POOL_ID,
      tokenUse: "id",
      clientId: CLIENT_ID,
    })
  : null;

export type AuthContext = {
  userId: string;
  homeId: string;
  role: string | null;
};

export async function authenticate(
  authorization?: string
): Promise<AuthContext | null> {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);

  if (DEV_BYPASS) {
    try {
      const claims = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString("utf8")
      );
      return claimsToContext(claims);
    } catch {
      return null;
    }
  }

  if (!verifier) return null;
  try {
    const claims = await verifier.verify(token);
    return claimsToContext(claims);
  } catch {
    return null;
  }
}

function claimsToContext(claims: Record<string, any>): AuthContext {
  return {
    userId:
      claims["custom:userId"] ||
      claims.email ||
      claims["cognito:username"] ||
      claims.sub,
    homeId: claims["custom:homeId"] || claims.homeId || "unknown-home",
    role: claims["custom:role"] || null,
  };
}
