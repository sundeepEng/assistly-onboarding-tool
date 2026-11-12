import type { NextApiRequest, NextApiResponse } from "next";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const region = process.env.NEXT_PUBLIC_AWS_REGION;
    const identityPoolId = process.env.NEXT_PUBLIC_AWS_IDENTITY_POOL_ID;
    const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;

    if (!region || !identityPoolId || !userPoolId) {
      return res
        .status(500)
        .json({ message: "Missing AWS configuration env vars." });
    }

    const idToken = getIdToken(req);
    if (!idToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { bucket, prefix, delimiter, maxKeys, continuationToken } =
      req.body ?? {};

    if (!bucket || typeof bucket !== "string") {
      return res.status(400).json({ message: "Missing or invalid bucket" });
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

    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: typeof prefix === "string" ? prefix : undefined,
        Delimiter: typeof delimiter === "string" ? delimiter : undefined,
        MaxKeys: typeof maxKeys === "number" ? maxKeys : undefined,
        ContinuationToken:
          typeof continuationToken === "string" ? continuationToken : undefined,
      }),
    );

    // Normalize keys to match your frontend helpers
    const contents = (response.Contents ?? []).map((obj) => ({
      key: obj.Key ?? "",
      size: obj.Size ?? 0,
      eTag: obj.ETag ?? null,
      lastModified: obj.LastModified ? obj.LastModified.toISOString() : null,
      storageClass: obj.StorageClass ?? null,
    }));

    const commonPrefixes = (response.CommonPrefixes ?? [])
      .map((p) => p.Prefix)
      .filter((p): p is string => Boolean(p));

    return res.status(200).json({
      contents,
      commonPrefixes,
      isTruncated: Boolean(response.IsTruncated),
      nextContinuationToken: response.NextContinuationToken ?? null,
      keyCount: response.KeyCount ?? contents.length,
      name: response.Name ?? bucket,
      prefix: response.Prefix ?? (typeof prefix === "string" ? prefix : ""),
      delimiter:
        response.Delimiter ??
        (typeof delimiter === "string" ? delimiter : null),
    });
  } catch (e: any) {
    console.error("list-objects error:", e);
    return res.status(500).json({
      message: "Failed to list S3 objects",
      error: e?.message || "Unknown error",
    });
  }
}
