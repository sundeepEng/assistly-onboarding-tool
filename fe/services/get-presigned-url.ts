import axios from "axios";
import Cookies from "js-cookie";

export const isPreSignedS3Url = (url: string) => {
  if (!url) return false;

  return (
    url.includes("X-Amz-Algorithm=") &&
    url.includes("X-Amz-Credential=") &&
    url.includes("X-Amz-Signature=")
  );
};

const tryExtractS3Location = (
  url: string,
): { bucket: string; key: string } | null => {
  if (!url) return null;

  try {
    const trimmed = url.trim();
    if (trimmed.startsWith("s3://")) {
      const without = trimmed.slice("s3://".length);
      const parts = without.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const bucket = parts.shift()!;
        const key = decodeURIComponent(parts.join("/"));
        return bucket && key ? { bucket, key } : null;
      }
      return null;
    }

    const u = new URL(trimmed);
    const host = u.host;
    const pathname = u.pathname || "";

    // virtual-hosted–style: <bucket>.s3.<region>.amazonaws.com/<key>
    if (/\.amazonaws\.com$/i.test(host) && host.includes(".s3.")) {
      const bucket = host.split(".s3.")[0];
      const key = pathname.replace(/^\//, "");
      return bucket && key ? { bucket, key: decodeURIComponent(key) } : null;
    }

    // path-style: s3.<region>.amazonaws.com/<bucket>/<key>
    if (/^s3[.-]/i.test(host) && host.includes("amazonaws.com")) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const bucket = parts.shift()!;
        const key = decodeURIComponent(parts.join("/"));
        return bucket && key ? { bucket, key } : null;
      }
    }

    return null;
  } catch {
    return null;
  }
};

const presignViaNextApi = async (bucket: string, key: string) => {
  const resp = await fetch("/api/s3/presign-get", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ bucket, key, expiresIn: 3600 }),
  });

  if (!resp.ok) {
    throw new Error("Failed to presign download");
  }

  const data: any = await resp.json();
  return data?.url as string | undefined;
};

const tryExtractS3Key = (url: string): string | null => {
  if (!url) return null;

  // Supports:
  // - https://<bucket>.s3.<region>.amazonaws.com/<key>
  // - https://s3.<region>.amazonaws.com/<bucket>/<key>
  // - s3://<bucket>/<key>
  try {
    const trimmed = url.trim();
    if (trimmed.startsWith("s3://")) {
      const without = trimmed.slice("s3://".length);
      const parts = without.split("/");
      if (parts.length >= 2) {
        parts.shift(); // bucket
        return decodeURIComponent(parts.join("/"));
      }
      return null;
    }

    const u = new URL(trimmed);
    const host = u.host;
    const pathname = u.pathname || "";

    // virtual-hosted–style
    if (/\.amazonaws\.com$/i.test(host) && host.includes(".s3.")) {
      const key = pathname.replace(/^\//, "");
      return key ? decodeURIComponent(key) : null;
    }

    // path-style
    if (/^s3[.-]/i.test(host) && host.includes("amazonaws.com")) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        parts.shift(); // bucket
        return decodeURIComponent(parts.join("/"));
      }
    }

    return null;
  } catch {
    return null;
  }
};

const fetchPreSignedUrl = async (s3FileURL: string) => {
  let cleanUrl = (s3FileURL || "").trim();

  if (!cleanUrl) {
    throw new Error("s3FileURL is empty");
  }

  if (isPreSignedS3Url(cleanUrl)) {
    try {
      const u = new URL(cleanUrl);
      // Strip querystring so we can generate a fresh presigned GET.
      cleanUrl = `${u.origin}${u.pathname}`;
    } catch {
      // If parsing fails, fall back to returning the original presigned URL.
      return cleanUrl;
    }
  }

  const loc = tryExtractS3Location(cleanUrl);
  if (loc?.bucket && loc?.key) {
    try {
      const url = await presignViaNextApi(loc.bucket, loc.key);
      if (url) return url;
    } catch {
      // fall through to legacy backend presign behavior
    }
  }

  const token = Cookies.get("idToken");

  try {
    const endpoint = `${process.env.NEXT_PUBLIC_BASE_URL}/v1/s3-pre-signed-url`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const key = tryExtractS3Key(cleanUrl);

    // Attempt #1: prefer sending the key (many backends expect this)
    if (key) {
      try {
        const response: any = await axios.get(endpoint, {
          params: { s3FileURL: key },
          headers,
        });
        return response?.data?.message;
      } catch {
        // fall through to try raw URL
      }
    }

    // Attempt #2: send raw URL (for backends that expect full URL)
    const response: any = await axios.get(endpoint, {
      params: { s3FileURL: cleanUrl },
      headers,
    });
    return response?.data?.message;
  } catch (error: any) {
    if (error?.response?.status === 400) {
      return cleanUrl;
    }
    console.error("Pre-signed URL fetch failed:", {
      status: error?.response?.status,
      data: error?.response?.data,
      sent: cleanUrl,
    });
    throw error;
  }
};

export default fetchPreSignedUrl;

 