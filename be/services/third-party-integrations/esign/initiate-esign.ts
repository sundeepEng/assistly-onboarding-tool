import { z } from 'zod';
import { FormatResponse } from '../../../utils/response-formatter';
import { SQSJobsDAL } from '../../../dal/sqs-jobs.dal';
import { InitiateESignEnvelopeSchema } from '../../../models/ThirdPartyIntegrations/esign.model';
import { v4 as uuidv4 } from 'uuid';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { UserTypes } from '../../../utils/constants';
import { GetUserData } from './generate-esign-envelope';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { HomeDAL } from '../../../dal/home.dal';
import {
  validateContractFilesExist,
  validateRecipientDocumentFields,
  getEnvelopeOptions,
} from '../../../utils/esign-utils';

const sqs = new SQSClient({ region: process.env.CURRENT_AWS_REGION! });
const s3 = new S3Client({ region: process.env.CURRENT_AWS_REGION! });
const sqsJobsDAL = new SQSJobsDAL();
const homeDAL = new HomeDAL();

export const initiateESignHandler = async (
  requestPayload: z.infer<typeof InitiateESignEnvelopeSchema>
) => {
  try {
    //#region Validate request payload
    const validatedPayload = InitiateESignEnvelopeSchema.parse(requestPayload);
    //#endregion

    console.info(
      `{api: '/initiate-esign', message: "Validated request payload", RequestPayload: ${JSON.stringify(
        validatedPayload
      )}}`
    );

    const { homeId, senderUserId, recipientUserId } = validatedPayload;

    // Fetch home details
    const homeDetails = await homeDAL.getHomeById(homeId);

    if (Object.keys(homeDetails).length === 0) {
      return FormatResponse(404, {
        message: 'Failed to initiate e-sign',
        error: 'Home not found with provided homeID',
      });
    }

    // Fetch Sender, Recipient Details - Sender is the PCHO and Recipient is the user to whom the contract is being sent
    const { senderDetails, recipientDetails } = await GetUserData(senderUserId, recipientUserId);

    // Check if the user's details exist in DB
    if (Object.keys(senderDetails)?.length === 0 || Object.keys(recipientDetails)?.length === 0) {
      return FormatResponse(404, {
        message: 'Failed to initiate e-sign',
        error: 'User data not found with provided userIDs',
      });
    }

    //#region Basic Validations

    // If the user is soft deleted, return error
    if (recipientDetails?.isDeleted === true) {
      return FormatResponse(400, {
        message: 'Failed to initiate e-sign',
        error: `Cannot initiate e-sign for the user with userId - ${recipientDetails?.userId} as the user is soft deleted`,
      });
    }

    // Check if the contract is already signed
    if (recipientDetails?.onboardingESignEnvelopeStatus === 'completed') {
      return FormatResponse(400, {
        message: 'Failed to initiate e-sign',
        error: 'Contract is already sent and signed',
      });
    }

    // Check for role validation for e-sign
    if (
      ![
        UserTypes.LEAD,
        UserTypes.SENIOR,
        UserTypes.PCGLEAD,
        UserTypes.PCG,
        UserTypes.NURSELEAD,
        UserTypes.NURSE,
      ].includes(recipientDetails?.role)
    ) {
      return FormatResponse(400, {
        message: 'Failed to initiate e-sign',
        error: 'The provided recipient role does not have any contracts to sign',
      });
    }

    //#region Contract Files and Document Fields Validation

    console.info('homeDetails', homeDetails);
    // Validate all required contract files exist in S3
    const contractFilesValidation = await validateContractFilesExist(
      homeId,
      recipientDetails.role,
      homeDetails.homeType
    );

    if (!contractFilesValidation.isValid) {
      return FormatResponse(404, {
        message: 'Failed to initiate e-sign',
        error: 'Required contract files are missing in S3',
        missingFiles: contractFilesValidation.missingFiles,
      });
    }

    // Validate recipient document fields against appropriate schema
    const documentFieldsValidation = validateRecipientDocumentFields(
      recipientDetails,
      recipientDetails.role
    );

    if (!documentFieldsValidation.isValid) {
      return FormatResponse(400, {
        message: 'Failed to initiate e-sign',
        error: 'Recipient document fields validation failed',
        validationErrors: documentFieldsValidation.errors,
      });
    }

    //#endregion

    //Check if homeID matches the users
    if (homeId !== recipientDetails.homeId) {
      return FormatResponse(409, {
        message: 'Failed to initiate e-sign',
        error: "The provided homeId does not match with user's home",
      });
    }

    // Error handling for missing user details
    if (!senderDetails?.email) {
      return FormatResponse(404, {
        message: 'Failed to initiate e-sign',
        error: 'Sender email does not exist',
      });
    }

    if (!recipientDetails?.email) {
      return FormatResponse(404, {
        message: 'Failed to initiate e-sign',
        error: 'Recipient email does not exist',
      });
    }

    if (!senderDetails?.name) {
      return FormatResponse(404, {
        message: 'Failed to initiate e-sign',
        error: 'Sender name not found',
      });
    }

    if (!recipientDetails?.name) {
      return FormatResponse(404, {
        message: 'Failed to initiate e-sign',
        error: 'Recipient name not found',
      });
    }

    if (!recipientDetails?.userId) {
      return FormatResponse(404, {
        message: 'Failed to initiate e-sign',
        error: 'Recipient userId not found',
      });
    }

    //#region Check if all files to be e-signed are available in modified contracts bucket in S3
    const missingFiles = await checkContractFilesExistInS3(
      homeId,
      recipientDetails.userId,
      recipientDetails.role,
      homeDetails.homeType,
      s3
    );

    if (missingFiles.length > 0) {
      return FormatResponse(404, {
        message: 'Failed to initiate e-sign',
        error: 'Required contract files are missing in S3',
        missingFiles: missingFiles,
      });
    }

    //#endregion

    //#region Create Job details object
    const JobId = uuidv4();
    const jobDetails = {
      jobId: JobId,
      status: 'pending',
      payload: validatedPayload,
      modifiedAt: new Date().toISOString(),
    };
    //#endregion

    //#region Push e-sign creation event to SQS Queue
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: process.env.ESIGN_QUEUE_URL!,
        MessageBody: JSON.stringify({
          jobId: JobId,
          payload: validatedPayload,
        }),
      })
    );
    //#endregion

    //#region Save job details to DB
    await sqsJobsDAL.upsertJob(jobDetails);
    //#endregion

    console.info(
      `{api: '/initiate-esign', message: "E-Sign envelope creation initiated", JobId: ${JobId}}`
    );

    return FormatResponse(202, {
      message: `E-Sign envelope creation is initiated successfully`,
      jobId: JobId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Failed to initiate e-sign', error.errors);

      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }

    console.error('Failed to initiate e-sign', error as Error);

    return FormatResponse(500, {
      message: 'Failed to initiate e-sign',
      error: {
        name: (error as Error).name || 'Unknown Error',
        message: (error as Error).message || '',
        stack: (error as Error).stack || '',
      },
    });
  }
};

export class EnvelopeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvelopeValidationError';
  }
}

async function checkContractFilesExistInS3(
  homeId: string,
  recipientUserId: string,
  recipientRole: string,
  homeType: string | undefined,
  s3Client: S3Client
): Promise<string[]> {
  const { documentConfig } = getEnvelopeOptions(recipientRole, homeType);
  const missingFiles: string[] = [];

  for (const doc of documentConfig) {
    const key = `${homeId}/${recipientUserId}/${doc.fileName}${doc.fileExtension}`;

    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: process.env.MODIFIED_CONTRACTS_BUCKET_NAME!,
          Key: key,
        })
      );
    } catch (error) {
      // If file doesn't exist, add to missing files list
      const errorCode = (error as any).Code || (error as any).name;
      if (
        errorCode === 'NotFound' ||
        errorCode === 'NoSuchKey' ||
        (error as any).$metadata?.httpStatusCode === 404
      ) {
        missingFiles.push(`${doc.fileName}${doc.fileExtension}`);
      } else {
        // Log other errors but don't fail the check
        console.error(`Error checking file ${key}:`, error);
        missingFiles.push(`${doc.fileName}${doc.fileExtension}`);
      }
    }
  }

  return missingFiles;
}
