import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import docuseal, { DocusealApiError } from '@docuseal/api';
import { z } from 'zod';
import { InitiateESignEnvelopeSchema } from '../../../models/ThirdPartyIntegrations/esign.model';
import { getEnvelopeOptions, getESignSecrets } from '../../../utils/esign-utils';
import { UsersDAL } from '../../../dal/users.dal';
import {
  UpdateLeadOrSeniorSchema,
  UpdatePCHOOrPCGLeadOrPCGSchema,
} from '../../../models/CRM/user.model';
import { updateUserHandler } from '../../update-user';

const usersDAL = new UsersDAL();

// Initialize S3 Client
const s3 = new S3Client({ region: process.env.CURRENT_AWS_REGION! });

export const generateESignEnvelopeHandler = async (
  requestPayload: z.infer<typeof InitiateESignEnvelopeSchema>
) => {
  try {
    const { homeId, senderUserId, recipientUserId } = requestPayload;

    // Fetch Sender, Recipient Details - Sender is the PCHO and Recipient is either PCG or Senior
    const { senderDetails, recipientDetails } = await GetUserData(senderUserId, recipientUserId);

    console.info('Sender, Receiver details fetched');

    // 1. Get E-Sign credentials from Secrets Manager and Initialize docuseal client
    const { API_KEY } = await getESignSecrets();
    docuseal.configure({ key: API_KEY, url: 'https://api.docuseal.com' });

    console.info('Docuseal client initialized');

    // 2. Get modified contracts from S3
    const fileBuffers = await fetchFilesFromS3(homeId, recipientUserId, recipientDetails?.role, s3);

    console.info('File buffers created', fileBuffers);

    // 3. Create envelope with files
    const { documentConfig } = getEnvelopeOptions(recipientDetails?.role);

    const envelope = await docuseal.createSubmissionFromDocx({
      message: {
        subject: `Please Sign: Onboarding Agreement for ${senderDetails.home}`,
        body: `
        Dear {{submitter.name}},

        To finalize the onboarding paperwork for ${recipientDetails.name} at ${senderDetails.home},
        we need your electronic signature on the Personal Care Agreement and related documents.

        Please click the link below to securely review and sign:
        ( The process takes less than 5 minutes and can be completed on your phone, tablet, or computer )

        {{submitter.link}}

        (This is a unique, secure link sent through our HIPAA-compliant platform, DocuSeal)

        Once all required signatures are received, a fully executed PDF copy will automatically be emailed to all parties for your records.

        If you experience any issues with the link, need assistance,
        or would prefer to sign in person, please contact the Owner of ${senderDetails.home}.

        Thank you for your prompt attention to this matter!

        Warm Regards,
        ${senderDetails.name}
        ${senderDetails.home}
        ${senderDetails.mobile} | ${senderDetails.email}
        `,
      },
      name: `Onboarding Agreement for ${senderDetails.home} - ${recipientDetails.name} | ${recipientDetails.email}`,
      documents: documentConfig.map((doc) => ({
        name: doc.fileName,
        file: fileBuffers[doc.documentId].toString('base64'),
      })),
      submitters: [
        {
          role: 'Recipient',
          name: recipientDetails.name,
          email: recipientDetails.email ?? '',
        },
        {
          role: 'Sender',
          name: senderDetails.name,
          email: senderDetails.email ?? '',
        },
      ],
      send_email: true,
      bcc_completed: senderDetails.email,
    });

    console.info(`Esign Envelope Created: `, JSON.stringify(envelope));

    // 4. Store the E-Sign Envelope ID and Status in DB for the recipient
    const updatedRecipient = {
      ...recipientDetails,
      onboardingESignEnvelopeId: envelope.id.toString(),
      onboardingESignEnvelopeStatus: envelope.status,
      onboardingESignEnvelopeCreatedAt: envelope.created_at,
    };

    await updateUserHandler(recipientDetails.userId, updatedRecipient);

    console.info(`Updated ESign details for the user - ${recipientDetails.userId}`);

    return {
      message: `Contract is created and sent to ${recipientDetails.email} for signing`,
    };
  } catch (error) {
    if ((error as Error).name === 'NoSuchKey') {
      throw error;
    }

    console.error('Failed to create E-Sign envelope', JSON.stringify(error as Error));

    throw error;
  }
};

/**
 * Fetches user details for the sender and recipient.
 * @param senderUserId - The user ID of the sender.
 * @param recipientUserId - The user ID of the recipient.
 * @returns An object containing sender and recipient details.
 */
export async function GetUserData(
  senderUserId: string,
  recipientUserId: string
): Promise<{
  senderDetails:
    | z.infer<typeof UpdatePCHOOrPCGLeadOrPCGSchema>
    | z.infer<typeof UpdateLeadOrSeniorSchema>;
  recipientDetails:
    | z.infer<typeof UpdatePCHOOrPCGLeadOrPCGSchema>
    | z.infer<typeof UpdateLeadOrSeniorSchema>;
}> {
  const userDetails = await usersDAL.batchFetchUsersByIds([senderUserId, recipientUserId]);

  const userMap = userDetails.reduce<Record<string, any>>((acc, user) => {
    acc[user.userId] = user;
    return acc;
  }, {});

  return {
    senderDetails: userMap[senderUserId],
    recipientDetails: userMap[recipientUserId],
  };
}

async function fetchFilesFromS3(
  homeId: string,
  recipientUserId: string,
  recipientRole: string,
  s3Client: S3Client
): Promise<Record<string, Buffer>> {
  const { documentConfig } = getEnvelopeOptions(recipientRole);

  const fileBuffers = await Promise.all(
    documentConfig.map(async (doc) => {
      const key = `${homeId}/${recipientUserId}/${doc.fileName}${doc.fileExtension}`;
      const contract = await s3Client.send(
        new GetObjectCommand({
          Bucket: process.env.MODIFIED_CONTRACTS_BUCKET_NAME!,
          Key: key,
        })
      );
      const buffer = Buffer.from(await contract.Body!.transformToByteArray());
      return { docId: doc.documentId, buffer };
    })
  );

  const buffers = Object.fromEntries(fileBuffers.map((f) => [f.docId, f.buffer]));

  return buffers;
}
