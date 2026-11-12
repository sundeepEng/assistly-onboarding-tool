import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { FormatResponse } from '../utils/response-formatter';

const s3 = new S3Client({ region: process.env.CDK_DEFAULT_REGION! });

export const s3PresignedUrlHandler = async (queryParameters: any) => {
  if (!queryParameters) {
    return FormatResponse(400, {
      message: 'Failed to get pre-signed URL',
      error: 'No query parameters provided',
    });
  }

  const { s3FileURL }: { s3FileURL: string } = queryParameters;

  const regex = /^https:\/\/([a-zA-Z0-9.-]+)\.s3\.[a-z0-9-]+\.amazonaws\.com\/(.+)$/;

  const match = s3FileURL.match(regex);

  if (!match) {
    return FormatResponse(400, {
      message: 'Failed to get pre-signed URL',
      error: 'No filekey found in the provided S3 URL',
    });
  }
  try {
    const s3BucketName: string = match[1];
    const s3FileKey: string = match[2];

    // Check if file exists in S3
    const headCommand = new HeadObjectCommand({
      Bucket: s3BucketName,
      Key: s3FileKey,
    });

    try {
      await s3.send(headCommand);
    } catch (headError: any) {
      if (headError.name === 'NoSuchKey' || headError.$metadata.httpStatusCode === 404) {
        return FormatResponse(404, {
          message: 'Failed to get pre-signed URL',
          error: `File '${s3FileKey}' does not exist`,
        });
      }
      throw headError; // Re-throw other SNS errors
    }

    const command = new GetObjectCommand({
      Bucket: s3BucketName,
      Key: s3FileKey,
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 7200 }); // URL expires in 120 minutes

    return FormatResponse(200, { message: signedUrl });
  } catch (error) {
    return FormatResponse(500, {
      message: 'Failed to get pre-signed URL',
      error: error,
    });
  }
};
