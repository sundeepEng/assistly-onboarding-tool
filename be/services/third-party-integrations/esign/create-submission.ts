import { z } from 'zod';
import { FormatResponse } from '../../../utils/response-formatter';
import { CreateDocusealSubmissionSchema } from '../../../models/ThirdPartyIntegrations/esign.model';
import { getESignSecrets } from '../../../utils/esign-utils';
import { UsersDAL } from '../../../dal/users.dal';

const usersDal = new UsersDAL();

export const createDocusealSubmissionHandler = async (
  requestPayload: z.infer<typeof CreateDocusealSubmissionSchema>
) => {
  try {
    const validatedData = CreateDocusealSubmissionSchema.parse(requestPayload);

    const { signerEmail, pdfBase64 } = validatedData;

    const [existingUser] = await usersDal.getUserByEmail(signerEmail);

    if (Object.keys(existingUser).length === 0) {
      return FormatResponse(404, {
        message: 'Failed to create docuseal submission',
        error: `User with email ${signerEmail} not found`,
      });
    }

    const signerName = existingUser?.name;

    const { API_KEY } = await getESignSecrets();

    if (!API_KEY) {
      console.error('Missing DOCUSEAL_TOKEN in secrets');

      return FormatResponse(500, {
        message: 'Failed to create docuseal submission',
        error: 'Missing DOCUSEAL_TOKEN in secrets',
      });
    }

    const baseUrl = 'https://api.docuseal.com';
    const headers = {
      'X-Auth-Token': API_KEY,
      'Content-Type': 'application/json',
    };

    // Step 1: Create a template from the base64-encoded PDF
    const templateResp = await fetch(`${baseUrl}/templates/pdf`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `EMAR-${Date.now()}`,
        documents: [
          {
            name: 'EMAR.pdf',
            file: pdfBase64,
          },
        ],
      }),
    });

    if (!templateResp.ok) {
      const err = await templateResp.json().catch(() => ({}));

      console.error('DocuSeal template creation failed:', err);

      return FormatResponse(500, {
        message: 'Failed to create docuseal template',
        error: (err as any)?.error || 'Failed to create template',
      });
    }

    const templateData: any = await templateResp.json();

    const templateId = templateData?.id;

    if (!templateId) {
      return FormatResponse(500, {
        message: 'Failed to create docuseal template',
        error: 'Failed to create template — no ID returned',
      });
    }

    console.info(`DocuSeal template created: ${templateId}`);

    // Step 2: Create a submission for the signer
    const submissionResp = await fetch(`${baseUrl}/submissions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        template_id: templateId,
        send_email: false,
        submitters: [
          {
            role: 'First Party',
            email: signerEmail,
            name: signerName,
          },
        ],
      }),
    });

    if (!submissionResp.ok) {
      const err = await submissionResp.json().catch(() => ({}));

      console.error('DocuSeal submission creation failed:', err);

      return FormatResponse(500, {
        message: 'Failed to create docuseal submission',
        error: (err as any)?.error || 'Failed to create submission',
      });
    }

    const submitters: any = await submissionResp.json();
    const submitter = Array.isArray(submitters) ? submitters[0] : submitters;
    const slug = submitter?.slug;

    if (!slug) {
      return FormatResponse(500, {
        message: 'Failed to create docuseal submission',
        error: 'Failed to get submission slug',
      });
    }

    console.info(`DocuSeal submission created — slug: ${slug}`);

    return FormatResponse(201, {
      message: 'DocuSeal submission created successfully',
      submissionId: submitter?.submission_id || submitter?.id,
      slug: slug,
      templateId: templateId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        errors: error.errors,
      });
    }

    console.error('DocuSeal create-submission error:', (error as Error).message);

    return FormatResponse(500, {
      message: 'Failed to create docuseal submission',
      error: (error as Error)?.message || 'DocuSeal API error',
    });
  }
};
