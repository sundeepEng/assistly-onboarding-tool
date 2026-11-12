import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { z } from 'zod';
import { Documents } from '../models/CRM/customer.model';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { UpdatePCHOOrPCGLeadOrPCGSchema, UpdateLeadOrSeniorSchema } from '../models/CRM/user.model';
import {
  SeniorOnboardingDocumentFieldsSchema,
  PCGOnboardingDocumentFieldsSchema,
} from '../models/ThirdPartyIntegrations/esign.model';
import { HomeTypes } from './constants';

export interface DocumentDefinition {
  documentId: string;
  fileName: string;
  fileExtension: string;
}

const s3 = new S3Client({ region: process.env.CURRENT_AWS_REGION! });

/**
 * Parses an array of document objects and extracts all key-value pairs from documentValues
 * @param documents Array of document objects containing documentValues
 * @returns A single object containing all key-value pairs from all documentValues
 */
export const extractDocumentValues = (
  documents: z.infer<typeof Documents>
): Record<string, any> => {
  // Handle null/undefined or non-array inputs
  if (!documents || !Array.isArray(documents)) {
    return {};
  }

  return documents.reduce((acc: Record<string, any>, document) => {
    // Skip if documentValues is not present, not an object, or is empty
    if (
      !document.documentValues ||
      typeof document.documentValues !== 'object' ||
      Object.keys(document.documentValues).length === 0
    ) {
      return acc;
    }

    // Merge all documentValues into a single object
    Object.assign(acc, document.documentValues);
    return acc;
  }, {});
};

export const getEnvelopeOptions = (role: string, homeType?: string) => {
  console.info('role', role, 'homeType', homeType);
  const seniorDocumentConfig: DocumentDefinition[] = [
    {
      documentId: '1',
      fileName: 'admission_agreement',
      fileExtension: '.docx',
    },
    {
      documentId: '2',
      fileName: 'house_rules',
      fileExtension: '.docx',
    },
    {
      documentId: '3',
      fileName: 'residents_rights',
      fileExtension: '.docx',
    },
    {
      documentId: '4',
      fileName: 'written_consents',
      fileExtension: '.docx',
    },
    {
      documentId: '5',
      fileName: 'resident_receipt_of_forms',
      fileExtension: '.docx',
    },
    {
      documentId: '6',
      fileName: 'designating_representative',
      fileExtension: '.docx',
    },
  ];

  const inHomeCareSeniorDocumentConfig: DocumentDefinition[] = [
    {
      documentId: '1',
      fileName: 'clinical_assessment',
      fileExtension: '.docx',
    },
    {
      documentId: '2',
      fileName: 'senior_bill_of_rights',
      fileExtension: '.docx',
    },
    {
      documentId: '3',
      fileName: 'service_agreement',
      fileExtension: '.docx',
    },
  ];

  const pcgDocumentConfig: DocumentDefinition[] = [
    {
      documentId: '1',
      fileName: 'indemnity_agreement',
      fileExtension: '.docx',
    },
    {
      documentId: '2',
      fileName: 'independent_contractor_offer',
      fileExtension: '.docx',
    },
    {
      documentId: '3',
      fileName: 'residents_rights',
      fileExtension: '.docx',
    },
    {
      documentId: '4',
      fileName: 'staff_receipt_of_forms',
      fileExtension: '.docx',
    },
  ];

  if (role === 'Senior' || role === 'Lead') {
    let documentConfig = seniorDocumentConfig;

    switch (homeType) {
      case HomeTypes.IN_HOME_CARE:
        documentConfig = inHomeCareSeniorDocumentConfig;
        break;
      case HomeTypes.PERSONAL_CARE_HOME:
      default:
        documentConfig = seniorDocumentConfig;
        break;
    }

    return {
      documentConfig,
    };
  } else if (role === 'PCG' || role === 'PCGLead') {
    return {
      documentConfig: pcgDocumentConfig,
    };
  }

  return { documentConfig: [], senderSignTabs: {}, recipientSignTabs: {} };
};

const secretsClient = new SecretsManagerClient();

export async function getESignSecrets(): Promise<any> {
  const command = new GetSecretValueCommand({
    SecretId: `ESign-${process.env.STAGE!}`,
  });

  const response = await secretsClient.send(command);

  if (!response.SecretString) throw new Error('Missing credentials');

  return JSON.parse(response.SecretString);
}

/**
 * Checks if all required contract files exist in S3 for a given role and home
 * @param homeId The home ID to check files for
 * @param role The user role (Senior, Lead, PCG, PCGLead)
 * @returns Object with validation status and missing files if any
 */
export const validateContractFilesExist = async (
  homeId: string,
  role: string,
  homeType?: string
): Promise<{ isValid: boolean; missingFiles: string[] }> => {
  const bucketName = process.env.ORIGINAL_CONTRACTS_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('ORIGINAL_CONTRACTS_BUCKET_NAME environment variable not set');
  }

  console.info('role', role, 'homeType', homeType, 'before getEnvelopeOptions');
  const { documentConfig } = getEnvelopeOptions(role, homeType);

  if (!documentConfig || documentConfig.length === 0) {
    return { isValid: true, missingFiles: [] }; // No documents required for this role
  }

  const s3Path = role == 'Senior' || role == 'Lead' ? `${homeId}/Senior` : `${homeId}/PCG`;

  try {
    // List all objects in the specified path
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: s3Path,
    });

    const response = await s3.send(listCommand);
    const existingFiles = response.Contents?.map((obj) => obj.Key?.split('/').pop()) || [];

    // Create expected file names from document config
    const expectedFiles = documentConfig.map((doc) => `${doc.fileName}${doc.fileExtension}`);

    // Find missing files
    const missingFiles = expectedFiles.filter(
      (expectedFile) => !existingFiles.some((existingFile) => existingFile?.includes(expectedFile))
    );

    return {
      isValid: missingFiles.length === 0,
      missingFiles,
    };
  } catch (error) {
    console.error('Error checking contract files in S3:', error);
    throw new Error(`Failed to validate contract files: ${error}`);
  }
};

/**
 * Validates recipient document fields against the appropriate schema
 * @param recipientUser The recipient user object with documents
 * @param role The recipient's role
 * @returns Object with validation status and errors if any
 */
export const validateRecipientDocumentFields = (
  recipientUser:
    | z.infer<typeof UpdatePCHOOrPCGLeadOrPCGSchema>
    | z.infer<typeof UpdateLeadOrSeniorSchema>,
  role: string
): { isValid: boolean; errors: any[] } => {
  // Extract document values from recipient's documents
  const documentValues = extractDocumentValues(recipientUser.documents || []);

  // Select appropriate schema based on role
  const schema =
    role === 'Senior' || role === 'Lead'
      ? SeniorOnboardingDocumentFieldsSchema
      : PCGOnboardingDocumentFieldsSchema;

  // Validate against the schema
  const validationResult = schema.safeParse(documentValues);

  if (validationResult.success) {
    return { isValid: true, errors: [] };
  } else {
    return {
      isValid: false,
      errors: validationResult.error.errors,
    };
  }
};
