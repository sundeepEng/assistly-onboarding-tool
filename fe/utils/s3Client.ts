// NOTE: This file must remain browser-safe. Do not import AWS SDK here.
// getS3Client is intentionally not supported in the browser.
export const getS3Client = () => {
  throw new Error("getS3Client is not available in the browser.");
};

export const checkRequiredFilesInS3 = async (
  homeId: string,
  subFolder: string,
  requiredFiles: string[],
): Promise<{ allPresent: boolean; missingFiles: string[] }> => {
  try {
    const bucketName =
      process.env.NEXT_PUBLIC_AWS_MODIFIED_CONTRACTS_BUCKET_NAME!;
    const base = String(homeId).replace(/^\/+|\/+$/g, "");
    const folderPath = `${base}/${subFolder}/`;

    const resp = await fetch("/api/s3/list-objects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        bucket: bucketName,
        prefix: folderPath,
      }),
    });

    if (!resp.ok) {
      throw new Error("Failed to list S3 folder");
    }

    const data: any = await resp.json();
    const contents: any[] = data?.contents ?? [];

    if (!contents || contents.length === 0) {
      return { allPresent: false, missingFiles: requiredFiles };
    }

    const existingFiles = contents
      .map((obj) => obj?.key)
      .filter((k) => typeof k === "string" && k && !k.endsWith("/"))
      .map((k: string) => k.split("/").pop()!.split(".")[0]);

    const missingFiles = requiredFiles.filter(
      (file) => !existingFiles.includes(file),
    );

    return { allPresent: missingFiles.length === 0, missingFiles };
  } catch (error) {
    console.error("Error checking S3 folder:", error);
    throw new Error("Failed to check S3 folder");
  }
};
