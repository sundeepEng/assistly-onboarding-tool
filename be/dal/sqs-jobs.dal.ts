import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { dynamoClient } from "../utils/dynamo-client";

export class SQSJobsDAL {
  private tableName: string;

  constructor() {
    this.tableName = process.env.SQS_JOBS_TABLE_NAME!;
  }

  /**
   * Fetches a job by its ID.
   * @param jobId The role's unique identifier which is the UUID.
   * @returns The job object if found, otherwise an empty object.
   */

  async fetchByJobId(jobId: string) {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ jobId }),
    });

    try {
      const response = await dynamoClient.send(command);
      return response.Item ? unmarshall(response.Item) : {};
    } catch (error) {
      console.error("Error querying by jobID", error);
      throw error;
    }
  }

  /**
   * Upsert a Job in DynamoDB.
   * @param jobDetails The job data to be inserted/updated.
   */
  async upsertJob(jobDetails: Record<string, any>) {
    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(jobDetails),
    });

    try {
      await dynamoClient.send(command);
    } catch (error) {
      console.error("Error in upsert job:", error);
      throw error;
    }
  }
}
