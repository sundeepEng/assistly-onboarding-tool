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
const DEV_BYPASS = process.env.AUTH_DEV_BYPASS === "1" && process.env.NODE_ENV !== "production";

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
  homeType: string;
  authorization: string;
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
      return resolveContext(claims, authorization);
    } catch {
      return null;
    }
  }

  if (!verifier) return null;
  try {
    const claims = await verifier.verify(token);
    return resolveContext(claims, authorization);
  } catch {
    return null;
  }
}

function claimsToContext(claims: Record<string, any>): AuthContext {
  return {
    homeType: claims["custom:homeType"] || "",
    authorization: "",
    userId:
      claims["custom:userId"] ||
      claims.email ||
      claims["cognito:username"] ||
      claims.sub,
    homeId: claims["custom:homeId"] || claims.homeId || "",
    role: claims["custom:role"] || null,
  };
}

async function resolveContext(claims: Record<string, any>, authorization: string): Promise<AuthContext | null> {
  const ctx = claimsToContext(claims);
  if (!ctx.userId || !ctx.homeId || !ctx.role) return null;
  if (!DEV_BYPASS) {
    if (!process.env.ASSISTLY_API_URL) return null;
    const response = await fetch(`${process.env.ASSISTLY_API_URL}/v1/home/${encodeURIComponent(ctx.homeId)}`, {headers: {Authorization: authorization}, signal: AbortSignal.timeout(8000)});
    if (!response.ok) return null;
    const data = await response.json();
    ctx.homeType = data.home?.homeType ?? "";
  }
  ctx.authorization = authorization;
  return ctx;
}
