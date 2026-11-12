import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { FormatResponse } from '../../../utils/response-formatter';
import { DocusealBuilderTokenRequestSchema } from '../../../models/ThirdPartyIntegrations/esign.model';
import { getESignSecrets } from '../../../utils/esign-utils';

export const generateDocusealBuilderTokenHandler = async (requestPayload: unknown) => {
  try {
    const { API_KEY } = await getESignSecrets();
    const { DOCUSEAL_USER_EMAIL } = await getESignSecrets();
    const secret = API_KEY;
    const userEmail = DOCUSEAL_USER_EMAIL;

    if (!secret || !userEmail) {
      return FormatResponse(500, {
        message: 'Missing DOCUSEAL_TOKEN or DOCUSEAL_USER_EMAIL env vars.',
      });
    }

    const body = DocusealBuilderTokenRequestSchema.parse(requestPayload ?? {});

    const payload: Record<string, unknown> = {
      user_email: userEmail,
    };

    if (body.integrationEmail) payload.integration_email = body.integrationEmail;
    if (body.name) payload.name = body.name;
    if (Array.isArray(body.documentUrls) && body.documentUrls.length > 0) {
      payload.document_urls = body.documentUrls;
    }
    if (typeof body.templateId === 'number') payload.template_id = body.templateId;
    if (body.externalId) payload.external_id = body.externalId;
    if (Array.isArray(body.roles) && body.roles.length > 0) {
      payload.roles = body.roles.join(',');
    }

    const token = jwt.sign(payload, secret);

    return FormatResponse(200, { token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Request payload validation failed',
        errors: error.errors,
      });
    }

    console.error('Failed to sign DocuSeal builder token', error);

    return FormatResponse(500, {
      message: (error as Error)?.message || 'Failed to sign token',
    });
  }
};
