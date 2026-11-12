import {
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { dynamoClient } from "../utils/dynamo-client";
import { decryptUserData, encryptUserData } from "../utils/crypto-util";

export class WSCONNECTIONSDAL {
  private tableName: string;

  constructor() {
    this.tableName = process.env.WS_CONNECTIONS_TABLE_NAME!;
  }

  /**
   * Inserts a connection.
   * @param connection Object with keys - connectionId, userId, connectedAt, ttl
   */

  async insertConnection(connection: Record<string, any>) {
    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(connection),
    });

    try {
      await dynamoClient.send(command);
    } catch (error) {
      console.error(
        "Error inserting connection",
        JSON.stringify(error as Error)
      );
      throw error;
    }
  }

  /**
   * Deletes a connection.
   * @param connectionId The unique id per connection.
   */
  async deleteConnection(connectionId: string) {
    const command = new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({ connectionId }),
      ReturnValues: "ALL_OLD",
    });

    try {
      const response = await dynamoClient.send(command);

      return response.Attributes ? unmarshall(response.Attributes) : {};
    } catch (error) {
      console.error(
        "Error deleting connection:",
        JSON.stringify(error as Error)
      );
      throw error as Error;
    }
  }

  async getUserConnections(
    userId: string
  ): Promise<{ connectionId: string }[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: `WSUserIdIndex-${process.env.STAGE}`,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: {
        ":uid": { S: userId },
      },
      ProjectionExpression: "connectionId",
    });

    const response = await dynamoClient.send(command);
    return (
      response.Items?.map((item) => ({
        connectionId: item.connectionId.S!,
      })) || []
    );
  }
}
