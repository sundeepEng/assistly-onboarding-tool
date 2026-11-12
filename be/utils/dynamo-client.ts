import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export const dynamoClient = new DynamoDBClient({
  region: process.env.CURRENT_AWS_REGION!,
});
