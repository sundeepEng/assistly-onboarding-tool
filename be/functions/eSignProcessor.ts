import { SQSEvent } from "aws-lambda";
import { generateESignEnvelopeHandler } from "../services/third-party-integrations/esign/generate-esign-envelope";
import { SQSJobsDAL } from "../dal/sqs-jobs.dal";
import { EnvelopeValidationError } from "../services/third-party-integrations/esign/initiate-esign";

const sqsJobsDAL = new SQSJobsDAL();

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const { jobId, payload } = JSON.parse(record.body);

    console.info(
      "Processing Job: ",
      jobId,
      "with payload: ",
      JSON.stringify(payload)
    );

    try {
      const { message } = await generateESignEnvelopeHandler(payload);

      const jobDetails = {
        jobId: jobId,
        status: "success",
        payload: payload,
        result: message,
        modifiedAt: new Date().toISOString(),
      };

      await sqsJobsDAL.upsertJob(jobDetails);
    } catch (err: any) {
      console.error(
        `Failed to process E-Sign job with JobId: ${jobId}`,
        JSON.stringify(err)
      );

      const isValidationErr = err instanceof EnvelopeValidationError;

      const jobDetails = {
        jobId: jobId,
        status: "failed",
        payload: payload,
        errorType: isValidationErr ? "Validation" : "System",
        error: err.message,
        modifiedAt: new Date().toISOString(),
      };

      await sqsJobsDAL.upsertJob(jobDetails);
    }
  }
};
