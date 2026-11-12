import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DocumentDefinition, getEnvelopeOptions } from '../../../utils/esign-utils';
import { FormatResponse } from '../../../utils/response-formatter';
import { UsersDAL } from '../../../dal/users.dal';
import { updateUserHandler } from '../../update-user';
import { updateClinicalHandler } from '../../update-clinical';
import { ClinicalDAL } from '../../../dal/clinical.dal';
import { DocumentStatus } from '../../../utils/constants';
import { HomeDAL } from '../../../dal/home.dal';

const usersDAL = new UsersDAL();
const clinicalDAL: ClinicalDAL = new ClinicalDAL();
const homeDAL: HomeDAL = new HomeDAL();

const s3Client = new S3Client({ region: process.env.CDK_DEFAULT_REGION! });

//#region Docuseal Interfaces
interface DocuSealDocument {
  name: string;
  url: string;
  fileBuffer?: Buffer;
}

interface DocuSealSubmitter {
  id: number;
  uuid: string;
  email: string;
  name: string;
  external_id?: string;
  status: 'completed' | 'declined' | 'opened' | 'sent' | 'awaiting';
  completed_at?: string;
  role: string;
}

interface DocuSealTemplate {
  id: number;
  name: string;
  external_id: string;
  created_at: string;
  updated_at: string;
  folder_name: string;
}

interface DocuSealSubmissionData {
  id: number;
  status: 'completed' | 'declined' | 'expired' | 'pending';
  submitters: DocuSealSubmitter[];
  template: DocuSealTemplate;
  documents: DocuSealDocument[];
  created_at: string;
  expire_at?: string;
}

type DocuSealWebhookEvent =
  | {
      event_type: 'submission.completed' | 'submission.created';
      timestamp: string;
      data: DocuSealSubmissionData;
    }
  | {
      event_type: 'form.declined';
      timestamp: string;
      data: DocuSealFormEventData;
    };

/**
 * Shape of data for form-level events: form.completed, form.viewed, form.started, form.declined.
 * Here `data` is a single submitter object with a nested `submission`.
 */
interface DocuSealFormEventData {
  id: number;
  email: string;
  name: string;
  role: string;
  status: 'completed' | 'declined' | 'opened' | 'sent' | 'awaiting';
  decline_reason?: string;
  declined_at?: string;
  completed_at?: string;
  documents: DocuSealDocument[];
  submission: {
    id: number;
    status: 'completed' | 'declined' | 'expired' | 'pending';
    url?: string;
    created_at: string;
  };
}

//#endregion

export const ESignWebhookHandler = async (requestPayload: any) => {
  try {
    console.info('ESign Webhook triggered', JSON.stringify(requestPayload));

    const payload = requestPayload as DocuSealWebhookEvent;

    // --- Handle form.declined. The declined event has different payload form submission ---
    if (payload.event_type === 'form.declined') {
      return await handleFormDeclined(payload.data as DocuSealFormEventData);
    }

    const { data } = payload;
    console.info('Data in Docuseal webhook', JSON.stringify(data));

    const { documents } = data as DocuSealSubmissionData;

    if (documents?.length === 1) {
      console.info('Single Contract Webhook triggered');

      if (payload.event_type === 'submission.completed') {
        console.info('Single contract submission completed webhook');

        let parsedExternalId: any = {};
        try {
          parsedExternalId = JSON.parse(data.template.external_id);
        } catch (e) {
          parsedExternalId = {};
        }

        const { userId, homeId } = parsedExternalId;

        // // Fetch the recipient email
        // const recipientEmail =
        //   data.submitters[0].role === 'Resident'
        //     ? data.submitters[0].email
        //     : data.submitters[1].email;

        console.info('Fetching recipient details', 'userId : ', userId, 'homeId : ', homeId);

        if (typeof userId === 'string' && userId.length) {
          const recipientDetails = await usersDAL.fetchUserById(userId);

          if (Object.keys(recipientDetails).length === 0) {
            console.error(`No user found for user ID: ${userId}`);

            return FormatResponse(200, {
              message: 'User not found for user ID, skipping',
              success: true,
            });
          }

          await UploadSingleSignedDoc(recipientDetails, data, s3Client);
        } else if (typeof homeId === 'string' && homeId.length) {
          const existingHome = await homeDAL.getHomeById(homeId);

          if (Object.keys(existingHome).length === 0) {
            console.error(`No home found for home ID: ${homeId}`);

            return FormatResponse(200, {
              message: 'Home not found for home ID, skipping',
              success: true,
            });
          }

          await UploadSingleSignedDocForHome(existingHome, data, s3Client);
        } else {
          console.error(`Missing userId/homeId in template.external_id`);

          return FormatResponse(200, {
            message: 'Missing userId/homeId in template.external_id, skipping',
            success: true,
          });
        }
      }

      return FormatResponse(200, {
        message: 'Webhook processed successfully for single contract',
        success: true,
      });
    } else {
      const recipientEmail =
        data.submitters[0].role === 'Recipient'
          ? data.submitters[0].email
          : data.submitters[1].email;

      // Update the envelope status in DB
      const [recipientDetails] = await usersDAL.getUserByEmail(recipientEmail);

      if (Object.keys(recipientDetails).length === 0) {
        console.error(`No user found for declined email: ${recipientEmail}`);

        return FormatResponse(200, {
          message: 'User not found for declined form, skipping',
          success: true,
        });
      }

      if (recipientDetails?.onboardingESignEnvelopeStatus === 'completed') {
        console.info(`Webhook - Envelope is already completed. Skipping the webhook`);

        return FormatResponse(200, {
          message: 'Envelope is already signed. Skipping webhook',
          success: true,
        });
      }

      const updatedRecipientDetails: any = {
        ...recipientDetails,
        onboardingESignEnvelopeStatus: data.status,
        modifiedAt: new Date().toISOString(),
      };

      await updateUserHandler(recipientDetails.userId, updatedRecipientDetails);

      if (payload.event_type === 'submission.completed') {
        // Update the envelope status for the users - sender, recipient in DB
        await UploadSignedDocs(updatedRecipientDetails, data, s3Client);

        console.info(
          `Webhook processed successfully for envelope: ${data.id} and for user: ${recipientEmail}`
        );
      }

      return FormatResponse(200, {
        message: 'Webhook processed successfully',
        success: true,
      });
    }
  } catch (error) {
    console.info('Error in ESignWebhookHandler', JSON.stringify((error as Error).message));

    return FormatResponse(500, {
      message: 'Failed update envelope webhook',
      success: false,
      errorName: (error as Error).name,
      errorMessage: (error as Error).message,
      errorStack: (error as Error).stack,
    });
  }
};

/**
 * Handles form.declined webhook events.
 * `data` here is a single submitter object (not a submission with submitters[]).
 */
async function handleFormDeclined(data: DocuSealFormEventData) {
  console.info('Form declined webhook triggered', JSON.stringify(data));

  const recipientEmail = data.email;
  const declineReason = data.decline_reason ?? 'No reason provided';
  const declinedAt = data.declined_at ?? new Date().toISOString();

  console.info(`Form declined by: ${recipientEmail}, reason: ${declineReason}`);

  const [recipientDetails] = await usersDAL.getUserByEmail(recipientEmail);

  if (Object.keys(recipientDetails).length === 0) {
    console.error(`No user found for declined email: ${recipientEmail}`);

    return FormatResponse(200, {
      message: 'User not found for declined form, skipping',
      success: true,
    });
  }

  // Avoid overwriting an already-completed status
  if (recipientDetails?.onboardingESignEnvelopeStatus === 'completed') {
    console.info('Envelope already completed. Skipping declined update.');
    return FormatResponse(200, {
      message: 'Envelope already completed. Skipping declined update.',
      success: true,
    });
  }

  const updatedRecipientDetails: any = {
    ...recipientDetails,
    onboardingESignEnvelopeStatus: 'declined',
    modifiedAt: new Date().toISOString(),
  };

  await updateUserHandler(recipientDetails.userId, updatedRecipientDetails);

  console.info(`Declined status saved for user: ${recipientDetails.userId}`);

  return FormatResponse(200, {
    message: 'Form declined webhook processed successfully',
    success: true,
  });
}

async function UploadSignedDocs(
  recipientDetails: Record<string, any>,
  ESignedData: DocuSealSubmissionData,
  s3Client: S3Client
) {
  const envelopeDocuments = await DownloadSignedDocuments(ESignedData.documents);

  console.info('Fetched signed envelope documents');

  const bucketName = process.env.MODIFIED_CONTRACTS_BUCKET_NAME!;
  const region = process.env.CURRENT_AWS_REGION!;
  const uploadedSignedDocs: Array<{ docName: string; s3Url: string }> = [];

  // Upload signed docs to S3 and capture S3 URLs
  for (const doc of envelopeDocuments) {
    const docName = doc.name;
    const key = `${recipientDetails.homeId}/${recipientDetails.userId}/${docName}.pdf`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: doc.fileBuffer,
        ContentType: 'application/pdf',
      })
    );

    console.info(`Uploaded ${key}`);

    // Construct S3 URL
    const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
    uploadedSignedDocs.push({ docName, s3Url });
  }

  console.info(`Documents uploaded to S3 successfully`);
  console.info('Uploaded Signed Docs', uploadedSignedDocs);

  // Update documents in DB with signed PDF URL while keeping original documentUrl
  const { documents: userDocuments } = recipientDetails;

  console.info('Recipient Details', recipientDetails);

  console.info('Existing User Documents:', userDocuments);

  const { documentConfig } = getEnvelopeOptions(recipientDetails?.role);

  const updatedUserDocuments = userDocuments.map((doc: any) => {
    const uploadedDoc = uploadedSignedDocs.find((item) => item.docName === doc.documentName);

    if (uploadedDoc) {
      const existingSignedDocumentUrls = Array.isArray(doc.signedDocumentUrl)
        ? doc.signedDocumentUrl
        : [];

      return {
        ...doc,
        signedDocumentUrl: [
          ...existingSignedDocumentUrls,
          { url: uploadedDoc.s3Url, createdAt: new Date().toISOString() },
        ],
        createdAt: new Date().toISOString(),
      };
    }

    return doc;
  });

  console.info('Updated User Documents:', updatedUserDocuments);

  const updatedRecipientDetails: any = {
    ...recipientDetails,
    documents: updatedUserDocuments,
    modifiedAt: new Date().toISOString(),
  };

  await updateUserHandler(recipientDetails.userId, updatedRecipientDetails);

  // If resident had completed the onboarding documents signing, then create an entry in clinical table with In Home status
  const clinicalDetails = await clinicalDAL.fetchClinicalByUserId(recipientDetails.userId);

  await updateClinicalHandler(recipientDetails.userId, {
    ...clinicalDetails,
    userId: recipientDetails.userId,
    status: 'In Home',
  });

  return;
}

async function UploadSingleSignedDocForHome(
  homeDetails: Record<string, any>,
  ESignedData: DocuSealSubmissionData,
  s3Client: S3Client
) {
  const normalizeDocumentName = (name: string) => {
    return name.trim().replace(/\.(docx|pdf)$/i, '');
  };

  const envelopeDocuments = await DownloadSignedDocuments(ESignedData.documents);

  const bucketName = process.env.USER_DOCUMENTS_BUCKET_NAME!;
  const region = process.env.CURRENT_AWS_REGION!;
  const uploadedSignedDocs: Array<{ docName: string; s3Url: string }> = [];
  const homeDocuments = Array.isArray(homeDetails?.documents) ? homeDetails.documents : [];

  console.info('Home Documents:', homeDocuments);

  for (const doc of envelopeDocuments) {
    const docName = normalizeDocumentName(doc.name);

    const existingDoc = homeDocuments.find(
      (d: any) => normalizeDocumentName(String(d.documentName ?? '')) === docName
    );
    const newVersion = (existingDoc?.version ?? 0) + 1;

    const key = `${homeDetails.homeId}/home/ComplianceDocuments/${docName}__v${newVersion}__.pdf`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: doc.fileBuffer,
        ContentType: 'application/pdf',
      })
    );

    const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
    uploadedSignedDocs.push({ docName, s3Url });
  }

  console.info('Uploaded signed docs for home', uploadedSignedDocs);

  const updatedHomeDocuments = homeDocuments.map((doc: any) => {
    const userDocName = normalizeDocumentName(String(doc.documentName ?? ''));
    console.info('User doc name..:', doc, userDocName);
    const uploadedDoc = uploadedSignedDocs.find((item) => item.docName === userDocName);

    if (!uploadedDoc) {
      return doc;
    }

    const existingSignedDocumentUrls = Array.isArray(doc.signedDocumentUrl)
      ? doc.signedDocumentUrl
      : [];

    return {
      ...doc,
      signedDocumentUrl: [
        ...existingSignedDocumentUrls,
        { url: uploadedDoc.s3Url, createdAt: new Date().toISOString() },
      ],
      createdAt: new Date().toISOString(),
      version: (doc.version ?? 0) + 1,
      documentStatus: DocumentStatus.COMPLETED,
    };
  });

  const updatedHomeDetails: any = {
    ...homeDetails,
    documents: updatedHomeDocuments,
    modifiedAt: new Date().toISOString(),
  };

  console.info('Updating home details', updatedHomeDetails);

  await homeDAL.upsertHome(updatedHomeDetails);

  return;
}

async function UploadSingleSignedDoc(
  recipientDetails: Record<string, any>,
  ESignedData: DocuSealSubmissionData,
  s3Client: S3Client
) {
  const normalizeDocumentName = (name: string) => {
    return name.trim().replace(/\.(docx|pdf)$/i, '');
  };

  const envelopeDocuments = await DownloadSignedDocuments(ESignedData.documents);

  console.info('Fetched signed envelope documents');

  const bucketName = process.env.MODIFIED_CONTRACTS_BUCKET_NAME!;
  const region = process.env.CURRENT_AWS_REGION!;
  const uploadedSignedDocs: Array<{ docName: string; s3Url: string }> = [];
  const { documents: userDocuments } = recipientDetails;

  // Upload signed doc to S3 and capture S3 URLs
  for (const doc of envelopeDocuments) {
    const docName = normalizeDocumentName(doc.name);

    // Find the corresponding document in user documents to get current version
    const userDoc = userDocuments.find(
      (ud: any) => normalizeDocumentName(String(ud.documentName ?? '')) === docName
    );
    const docVersion = userDoc?.version ? userDoc.version : 1;

    // Include version in the S3 file path
    const key = `${recipientDetails.homeId}/${recipientDetails.userId}/${docName}__v${docVersion}__.pdf`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: doc.fileBuffer,
        ContentType: 'application/pdf',
      })
    );

    console.info(`Uploaded ${key}`);

    // Construct S3 URL
    const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
    uploadedSignedDocs.push({ docName, s3Url });
  }

  console.info(`Documents uploaded to S3 successfully`);
  console.info(`Uploaded Signed Docs: ${JSON.stringify(uploadedSignedDocs)}`);

  // Update documents in DB with signed PDF URL while keeping original documentUrl

  console.info('Recipient Details for', recipientDetails.userId);

  console.info(`Existing User Documents: ${JSON.stringify(userDocuments)}`);

  const updatedUserDocuments = userDocuments.map((doc: any) => {
    const userDocName = normalizeDocumentName(String(doc.documentName ?? ''));

    console.info('Processing doc', uploadedSignedDocs, doc.documentName);
    const uploadedDoc = uploadedSignedDocs.find((item) => item.docName === userDocName);
    console.info('Uploaded doc', uploadedDoc);
    if (uploadedDoc) {
      const existingSignedDocumentUrls = Array.isArray(doc.signedDocumentUrl)
        ? doc.signedDocumentUrl
        : [];

      return {
        ...doc,
        signedDocumentUrl: [
          ...existingSignedDocumentUrls,
          { url: uploadedDoc.s3Url, createdAt: new Date().toISOString() },
        ],
        createdAt: new Date().toISOString(),
        version: doc.version ? doc.version + 1 : 1,
        documentStatus: DocumentStatus.COMPLETED,
      };
    }

    console.info('No uploaded doc found for', doc.documentName);

    return doc;
  });

  console.info('Updated user documents', JSON.stringify(updatedUserDocuments));

  const updatedRecipientDetails: any = {
    ...recipientDetails,
    documents: updatedUserDocuments,
    modifiedAt: new Date().toISOString(),
  };

  await updateUserHandler(recipientDetails.userId, updatedRecipientDetails);

  return;
}

async function DownloadSignedDocuments(documents: DocuSealDocument[]) {
  const updatedDocs: DocuSealDocument[] = [];

  for (let doc of documents) {
    // Download the document
    const response = await fetch(doc.url);

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    // Get the file as ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    const docBuffer = Buffer.from(arrayBuffer);

    updatedDocs.push({ ...doc, fileBuffer: docBuffer });
  }

  return updatedDocs;
}
