import { v4 as uuidv4 } from "uuid";
import {
  onboardingDocsForPCG,
  onboardingDocsForNurse,
  onboardingDocsForSeniors,
  userRoles,
  allOnboardingDocsForSeniors,
  inHomeCareOnboardingDocsForSeniors,
} from "./constants";

// Function to create document objects from S3 folder
export const createDocumentObjectsFromS3Folder = async (
  homeId,
  userId,
  subFolder,
  isInHomeCare = false
) => {
  let onboardingDocs = [];

  if (subFolder === userRoles.SENIOR) {
    if (isInHomeCare) {
      onboardingDocs = inHomeCareOnboardingDocsForSeniors;
    } else {
      onboardingDocs = allOnboardingDocsForSeniors;
    }
  } else if (subFolder === userRoles.PCG) {
    onboardingDocs = onboardingDocsForPCG;
  } else if (subFolder === userRoles.NURSE) {
    onboardingDocs = onboardingDocsForNurse;
  }

  try {
    const bucketName =
      process.env.NEXT_PUBLIC_AWS_ORIGINAL_CONTRACTS_BUCKET_NAME;

    const base = String(homeId).replace(/^\/+|\/+$/g, "");

    const normalizedSubFolder = String(subFolder || "").toUpperCase();

    const personaFolder =
      normalizedSubFolder === String(userRoles.SENIOR).toUpperCase()
        ? "Senior"
        : normalizedSubFolder === String(userRoles.PCG).toUpperCase()
          ? "PCG"
          : subFolder;

    const folderPath = `${base}/${personaFolder}/`;

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

    if (!resp.ok) return [];

    const data: any = await resp.json();
    const contents: any[] = data?.contents ?? [];

    if (!contents || contents.length === 0) return [];

    const documentObjects = contents
      .filter((object) => object?.key && !String(object.key).endsWith("/"))
      .filter((object) => {
        const key = String(object.key || "");
        return key.toLowerCase().endsWith(".docx");
      })
      .filter((object) => {
        const fileName = String(object.key)
          .split("/")
          .pop()
          ?.replace(".docx", "")
          ?.toLowerCase();

        return onboardingDocs?.includes(fileName);
      })
      .map((object) => {
        const fileName = String(object.key)
          .split("/")
          .pop()
          ?.replace(".docx", "");

        // Encode each segment to be safe with spaces/special chars
        const encodedKey = String(object.key)
          .split("/")
          .map(encodeURIComponent)
          .join("/");

        const documentUrl = `https://${bucketName}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${encodedKey}`;

        return {
          documentId: uuidv4(),
          documentType: ".docx",
          documentName: fileName,
          documentUrl,
          createdByUserId: userId,
          createdAt: new Date().toISOString(),
          documentCategory: "onboarding",
          isRequiredDocument: false,
        };
      });

    return documentObjects;
  } catch (error) {
    console.error("Error processing S3 folder:", error);
    return [];
  }
};
