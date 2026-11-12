import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { FormatResponse } from "./response-formatter";
import { cognitoClient } from "../utils/cognito-client";
import { AdminDeleteUserCommand } from "@aws-sdk/client-cognito-identity-provider";

export async function deleteUserFiles(
  userDetails: Record<string, any>,
  bucketName: string
) {
  const s3 = new S3Client({ region: process.env.CURRENT_AWS_REGION! });

  if (!bucketName) {
    console.error(`${bucketName} environment variable not set`);

    return FormatResponse(500, {
      message: "Failed to delete user files",
      error: "S3 bucket configuration missing",
    });
  }

  try {
    const { homeId, userId } = userDetails;

    const prefix = bucketName.includes("user-profile-images")
      ? `${userId}`
      : `${homeId}/${userId}`;

    console.info(`Scanning for user files with prefix: ${prefix}`);

    // List all objects with the prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    });

    const listedObjects = await s3.send(listCommand);

    if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
      console.info(
        `No files found for user ${userId} in home ${userDetails.homeId}`
      );
      return;
    }

    // Create delete command with the objects
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: listedObjects.Contents.map(({ Key }) => ({ Key: Key! })),
      },
    });

    const deletedObjects = await s3.send(deleteCommand);

    if (deletedObjects.Deleted?.length) {
      console.info(
        `Successfully deleted ${deletedObjects.Deleted.length} files for user ${userId}`
      );
    }

    if (deletedObjects.Errors?.length) {
      const errors = deletedObjects.Errors.map(
        (err) => `${err.Key}: ${err.Message}`
      ).join(", ");

      return FormatResponse(500, {
        message: "Failed to delete user files",
        error: `Failed to delete some files: ${errors}`,
      });
    }

    return;
  } catch (error) {
    console.error("Error during user file deletion:", error);
    throw error;
  } finally {
    // Destroy the S3 client to clean up resources
    s3.destroy();
  }
}

/**
 * Deletes a user from AWS Cognito User Pool by their username (email).
 * @param email - The (email) of the user to delete.
 * @param userPoolId - The Cognito User Pool ID.
 * @returns A Promise that resolves when the user is deleted.
 */

export async function deleteUserFromCognito(
  email: string | undefined | null
): Promise<void> {
  if (!email) {
    console.info(`User does not have email in cognito, skipping delete`);
    return;
  }

  try {
    const command = new AdminDeleteUserCommand({
      Username: email,
      UserPoolId: process.env.USER_POOL_ID,
    });

    await cognitoClient.send(command);

    console.info(`User '${email}' successfully deleted from user pool.`);

    return;
  } catch (error: any) {
    console.error("Error deleting user from Cognito:", error);

    if ((error as Error).name === "UserNotFoundException") {
      console.info(`User with email ${email} not found in cognito`);
      return;
    }

    throw new Error(`Failed to delete user '${email}': ${error.message}`);
  }
}
