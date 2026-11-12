import { z } from "zod";
import { EmbeddedSignSchema } from "../../../models/ThirdPartyIntegrations/esign.model";
import { getESignSecrets } from "../../../utils/esign-utils";
import docuseal from "@docuseal/api";
import { FormatResponse } from "../../../utils/response-formatter";
import { UsersDAL } from "../../../dal/users.dal";

const usersDAL: UsersDAL = new UsersDAL();

export const EmbeddedSignatureHandler = async (
  requestPayload: z.infer<typeof EmbeddedSignSchema>
) => {
  try {
    EmbeddedSignSchema.parse(requestPayload);

    console.info("Embedded Sign Payload Data validated");

    const firstSubmitterEmail = requestPayload.submitters[0].email;
    const secondSubmitterEmail = requestPayload.submitters[1].email;

    const firstSubmitterDetails = await usersDAL.getUserByEmail(
      firstSubmitterEmail
    );
    const secondSubmitterDetails = await usersDAL.getUserByEmail(
      secondSubmitterEmail
    );

    if (firstSubmitterDetails.length === 0) {
      console.info(`Submitter with email ${firstSubmitterEmail} not found`);

      return FormatResponse(404, {
        message: "Failed to generate submission",
        error: `Submitter with email ${firstSubmitterEmail} not found`,
      });
    }

    if (secondSubmitterDetails.length === 0) {
      console.info(`Submitter with email ${secondSubmitterEmail} not found`);

      return FormatResponse(404, {
        message: "Failed to generate submission",
        error: `Submitter with email ${firstSubmitterEmail} not found`,
      });
    }

    // Get E-Sign credentials from Secrets Manager and Initialize docuseal client
    const { API_KEY } = await getESignSecrets();
    docuseal.configure({ key: API_KEY, url: "https://api.docuseal.com" });

    // Check for existing submission
    const externalIds: string[] = requestPayload.submitters.map(
      (submitter) => submitter.external_id
    );

    console.info("Checking for existing submissions");

    const submitters = (
      await Promise.all(
        externalIds.map(async (externalId) => {
          const { data } = await docuseal.listSubmitters({
            external_id: externalId,
          });
          return data;
        })
      )
    ).flat();

    if (submitters?.length > 0) {
      console.info("Returning existing submission details");

      return FormatResponse(200, {
        message: "Fetched existing submission details",
        data: submitters,
      });
    }

    const response = await docuseal.createSubmission({
      template_id: requestPayload.templateId,
      submitters: requestPayload.submitters,
      send_email: false,
    });

    console.info("New submission created successfully");

    return FormatResponse(201, {
      message: "Embedded Signing URLs generated successfully",
      data: response.submitters,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`Embedded Signing URLs generation failed`);

      return FormatResponse(400, {
        message: "Request payload validation failed",
        errors: error.errors,
      });
    }

    console.error(
      `Embedded Signing URLs generation failed: `,
      JSON.stringify(error)
    );

    return FormatResponse(500, {
      message: "Internal Server Error",
      error: (error as Error).message,
    });
  }
};
