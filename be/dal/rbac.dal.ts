import { GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { dynamoClient } from "../utils/dynamo-client";
import { decryptUserData, encryptUserData } from "../utils/crypto-util";

export class RBACDAL {
  private tableName: string;
  private readonly excludeFields: Set<string>;

  constructor() {
    this.tableName = process.env.ROLE_ASSETS_MAPPING_TABLE_NAME!;
    this.excludeFields = new Set(["role"]);
  }

  /**
   * Fetches a role by its role name.
   * @param role The role's unique identifier which can be either of "PCHO", "Senior", "Lead", "PCGLead" or "PCG".
   * @returns The role object if found, otherwise an empty object.
   */

  async fetchByRole(role: string) {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({ role }),
    });

    try {
      const response = await dynamoClient.send(command);
      return response.Item ? decryptUserData(unmarshall(response.Item)) : {};
    } catch (error) {
      console.error("Error querying by role name", error);
      throw error;
    }
  }

  /**
   * Upserts a role in DynamoDB with encrypted data.
   * @param role The role data to be upserted.
   */
  async upsertByRole(roleAccess: any) {
    const encryptedData = encryptUserData(roleAccess, this.excludeFields);

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(encryptedData),
    });

    try {
      await dynamoClient.send(command);
    } catch (error) {
      console.error("Error upserting role:", error);
      throw error;
    }
  }
}
