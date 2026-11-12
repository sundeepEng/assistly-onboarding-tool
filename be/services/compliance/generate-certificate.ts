import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { FormatResponse } from '../../utils/response-formatter';
import { z, ZodError } from 'zod';
import { GenerateCertificateSchema } from '../../models/Compliance/compliance.model';
import { UsersDAL } from '../../dal/users.dal';
import { HomeDAL } from '../../dal/home.dal';
import { DocumentCategory } from '../../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import { updateUserHandler } from '../update-user';

const s3 = new S3Client({ region: process.env.CDK_DEFAULT_REGION! });
const usersDAL = new UsersDAL();
const homesDAL = new HomeDAL();

export const generateCertificateHandler = async (
  requestPayload: z.infer<typeof GenerateCertificateSchema>
) => {
  try {
    GenerateCertificateSchema.parse(requestPayload);

    console.info('Request payload validated:', requestPayload);

    const { userId, moduleName, moduleId } = requestPayload;

    const userDetails = await usersDAL.fetchUserById(userId);

    if (Object.keys(userDetails)?.length == 0) {
      return FormatResponse(404, {
        message: 'Failed to Generate Certificate',
        error: `No user found with userId - ${userId}`,
      });
    }

    console.info('User details fetched:', userDetails.userId);

    const homeId = userDetails.homeId;

    // Look up certificateDurationDays from the home's complianceTraining module
    const home = await homesDAL.getHomeById(homeId);
    const trainingModule = home?.complianceTraining?.find((m: any) => m.moduleId === moduleId);
    const certificateDurationDays = trainingModule?.certificateDurationDays;
    const templateData = {
      Certificate_name: moduleName,
      Name: userDetails.name as string,
      Date: new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: '2-digit',
        year: 'numeric',
      }),
    };

    console.info('Prepared template data:', templateData);

    const certificateTemplateBucket = process.env.ORIGINAL_CONTRACTS_BUCKET_NAME!;

    // Fetch the template from S3
    const certificateTemplateKey = `${homeId}/PCG/Certificate_Template.docx`;

    const getCommand = new GetObjectCommand({
      Bucket: certificateTemplateBucket,
      Key: certificateTemplateKey,
    });

    const templateResponse = await s3.send(getCommand);
    const templateBody = await templateResponse.Body?.transformToByteArray();

    console.info(
      `Certificate template - ${certificateTemplateKey} fetched from S3 bucket - ${certificateTemplateBucket}`
    );

    if (!templateBody) {
      return FormatResponse(404, {
        message: 'Certificate Template not found',
        error: `Could not retrieve object with key ${certificateTemplateKey}`,
      });
    }

    // Load into docxtemplater
    const zip = new PizZip(templateBody);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '[[', end: ']]' },
      nullGetter: (part) => {
        const tag = typeof part === 'string' ? part : part?.value;
        console.error('Missing placeholder:', tag);
        return `<<MISSING:${tag}>>`;
      },
    });

    // Render document with template data
    try {
      doc.render(templateData);
    } catch (error: any) {
      console.error('Docxtemplater error:', error);
      console.error('Error properties:', error.properties?.errors);
      throw error;
    }

    console.info('Certificate template rendered successfully');

    const updatedDocBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    // Upload generated file to S3
    const userBucketName = process.env.USER_DOCUMENTS_BUCKET_NAME!;
    const userBucketKey = `${homeId}/${userId}/${moduleName}_Certificate.docx`;

    const putCommand = new PutObjectCommand({
      Bucket: userBucketName,
      Key: userBucketKey,
      Body: updatedDocBuffer,
      ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    await s3.send(putCommand);

    console.info(`Certificate uploaded to S3: ${userBucketName}/${userBucketKey}`);

    // Update the User Documents record in DB
    let userDocuments = userDetails.documents ?? [];
    // Calculate document expiry date if certificateDurationDays is provided
    let documentExpiryDate: string | undefined;
    if (certificateDurationDays) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + certificateDurationDays);
      documentExpiryDate = expiryDate.toISOString().split('T')[0];
    }

    const newDocument = {
      documentId: uuidv4(),
      documentCategory: DocumentCategory.CERTIFICATE,
      documentType: '.docx',
      documentName: `${moduleName}_Certificate`,
      documentUrl: `https://${userBucketName}.s3.${process.env
        .CURRENT_AWS_REGION!}.amazonaws.com/${userBucketKey}`,
      isRequiredDocument: false,
      createdByUserId: userId,
      moduleId: moduleId,
      createdAt: new Date().toISOString(),
      ...(documentExpiryDate && { documentExpiryDate }),
    };

    userDocuments.push(newDocument);

    const updatedUserDetails: any = {
      ...userDetails,
      documents: userDocuments,
      completedComplianceDocumentIds: [
        ...(userDetails.completedComplianceDocumentIds ?? []),
        moduleId,
      ],
    };

    await updateUserHandler(userId, updatedUserDetails);

    // Generate pre-signed URL for download
    const preSignedUrlCommand = new GetObjectCommand({
      Bucket: userBucketName,
      Key: userBucketKey,
    });

    const signedUrl = await getSignedUrl(s3, preSignedUrlCommand, {
      expiresIn: 300,
    });

    return FormatResponse(201, {
      message: 'Certificate generated successfully',
      url: signedUrl,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('Validation error', error.errors);
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }
    console.error('Error generating certificate:', error);
    return FormatResponse(500, {
      message: 'Failed to generate certificate',
      error: error instanceof Error ? error.message : 'Server error',
    });
  }
};
