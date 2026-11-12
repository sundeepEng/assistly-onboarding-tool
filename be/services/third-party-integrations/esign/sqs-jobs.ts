import { SQSEvent } from "aws-lambda";
import { SQSJobsDAL } from "../../../dal/sqs-jobs.dal";
import { z } from "zod";
import { FormatResponse } from "../../../utils/response-formatter";

const sqsJobsDAL = new SQSJobsDAL();

export const sqsJobsHandler = async (jobId: any) => {
  try {
    const validatedPayload = z.string().uuid().parse(jobId);

    const jobDetails = await sqsJobsDAL.fetchByJobId(jobId);

    return FormatResponse(200, {
      message: "SQS Job details fetched successfully",
      jobDetails: jobDetails,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: "Request payload validation failed",
        error: error.errors,
      });
    }

    console.error("Error fetching job details", error);

    return FormatResponse(500, {
      message: "Error fetching sqs job details",
      error: error as Error,
    });
  }
};
