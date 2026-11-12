import type { NextApiRequest, NextApiResponse } from "next";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";

function getCookie(req: NextApiRequest, name: string) {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  const parts = raw.split(";").map((p) => p.trim());
  const found = parts.find((p) => p.startsWith(`${name}=`));
  if (!found) return undefined;
  return decodeURIComponent(found.slice(name.length + 1));
}

function getIdToken(req: NextApiRequest) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  return getCookie(req, "idToken");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const region = process.env.NEXT_PUBLIC_AWS_REGION;
    const identityPoolId = process.env.NEXT_PUBLIC_AWS_IDENTITY_POOL_ID;
    const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;

    if (!region || !identityPoolId || !userPoolId) {
      return res.status(500).json({ message: "Missing AWS configuration env vars." });
    }

    const idToken = getIdToken(req);
    if (!idToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { bucket, key, expiresIn } = req.body ?? {};
    if (!bucket || !key) {
      return res.status(400).json({ message: "Missing bucket or key" });
    }

    const s3 = new S3Client({
      region,
      credentials: fromCognitoIdentityPool({
        client: new CognitoIdentityClient({ region }),
        identityPoolId,
        logins: {
          [`cognito-idp.${region}.amazonaws.com/${userPoolId}`]: idToken,
        },
      }),
    });

    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(s3, command, {
      expiresIn: typeof expiresIn === "number" ? expiresIn : 3600,
    });

    return res.status(200).json({ url });
  } catch (e: any) {
    console.error("presigned get error:", e);
    return res.status(500).json({ message: e?.message || "Failed to presign GET" });
  }
}
