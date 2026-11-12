const REGION = process.env.NEXT_PUBLIC_AWS_REGION;

export const uploadToS3 = async (
  file: File,
  bucketPath: string,
  bucketName: string,
  isPublic?: boolean,
): Promise<string | null> => {
  try {
    const fileName = bucketPath;

    const presignResp = await fetch("/api/s3/presign-put", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        bucket: bucketName,
        key: fileName,
        contentType: file?.type,
      }),
    });

    if (!presignResp.ok) {
      throw new Error("Failed to presign upload");
    }

    const presignData: any = await presignResp.json();
    const putUrl = presignData?.url;
    if (!putUrl) {
      throw new Error("Missing presigned URL");
    }

    const putResp = await fetch(putUrl, {
      method: "PUT",
      headers: file?.type ? { "Content-Type": file.type } : undefined,
      body: file,
    });

    if (!putResp.ok) {
      throw new Error("Upload failed");
    }

    // Return the public URL of the uploaded file
    if (isPublic) {
      return getS3PublicUrl({
        bucket: bucketName,
        region: REGION,
        key: fileName,
      });
    } else {
      return getS3PreSignedFromattedUrl({
        bucket: bucketName,
        region: REGION,
        key: fileName,
      });
    }
  } catch (error) {
    console.error("Upload error:", error);
    return null;
  }
};

export const deleteFromS3 = async (
  fileName: string,
  bucketPath: string,
  bucketName: string,
) => {
  try {
    const resp = await fetch("/api/s3/delete-object", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        bucket: bucketName,
        key: bucketPath,
      }),
    });

    if (!resp.ok) {
      throw new Error("Failed to delete object");
    }

    return true;
  } catch (error) {
    console.error("Delete error:", error);
    return false;
  }
};

export async function getFileUrl(bucket: string, key: string) {
  const resp = await fetch("/api/s3/presign-get", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      bucket,
      key,
      expiresIn: 3600,
    }),
  });

  if (!resp.ok) {
    throw new Error("Failed to presign download");
  }

  const data: any = await resp.json();
  return data?.url;
}

export async function fetchFilesFroms3Folder(bucket: string, path: string) {
  const VIDEO_RE = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;
  const PPT_RE = /\.(ppt|pptx)$/i;
  const prefix = path.replace(/^\/+|\/+$/g, "") + "/";

  const listRootResp = await fetch("/api/s3/list-objects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      bucket,
      prefix,
      delimiter: "/",
    }),
  });

  if (!listRootResp.ok) {
    throw new Error("Failed to list S3 folder");
  }

  const listRootData: any = await listRootResp.json();
  const folders: string[] = (listRootData?.commonPrefixes ?? [])
    .map((p: any) => String(p))
    .map((p: string) => p.replace(prefix, "").replace(/\/$/, ""));
  const results: Record<string, { video?: string; ppt?: string }> = {};

  for (const folder of folders) {
    const subPrefix = `${prefix}${folder}/`;

    const subResp = await fetch("/api/s3/list-objects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        bucket,
        prefix: subPrefix,
      }),
    });

    if (!subResp.ok) {
      throw new Error("Failed to list S3 subfolder");
    }

    const subData: any = await subResp.json();
    const items: any[] = subData?.contents ?? [];
    for (const obj of items) {
      const key = obj?.key;
      if (!key) continue;
      const filename = String(key).split("/").pop()!;
      const url = `https://${bucket}.s3.${REGION}.amazonaws.com/${encodeURI(String(key))}`;

      const entry = (results[folder] ??= {});

      if (VIDEO_RE.test(filename)) entry.video = url;
      if (PPT_RE.test(filename)) entry.ppt = url;
    }
  }
  return results;
}

export const getS3PublicUrl = ({
  bucket,
  region,
  key,
}: {
  bucket: string;
  region: string;
  key: string;
}) => {
  if (!bucket || !region || !key) {
    throw new Error("Missing bucket, region, or key");
  }

  return `https://s3.${region}.amazonaws.com/${bucket}/${key}`;
};

export const getS3PreSignedFromattedUrl = ({
  bucket,
  region,
  key,
}: {
  bucket: string;
  region: string;
  key: string;
}) => {
  if (!bucket || !region || !key) {
    throw new Error("Missing bucket, region, or key");
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
};
