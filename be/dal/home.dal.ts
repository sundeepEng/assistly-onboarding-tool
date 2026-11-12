import { z } from "zod";
import { HomeSchema } from "../models/Home/home.model";
import {
  BatchGetItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { dynamoClient } from "../utils/dynamo-client";
import { decryptUserData, encryptUserData } from "../utils/crypto-util";

export class HomeDAL {
  private tableName: string;
  private readonly excludeFields: Set<string>;

  constructor() {
    this.tableName = process.env.HOME_TABLE_NAME!;
    this.excludeFields = new Set([
      "homeId",
      "homeName",
      "createdAt",
      "modifiedAt",
    ]);
  }

  /**
   * Fetches a home by its name.
   * @param homeName - The name of the home to fetch.
   * @returns The home data if found, otherwise an empty object.
   */
  async getByHomeName(homeName: string) {
    try {
      // Convert homeName to lowercase for consistency
      homeName = homeName.toLowerCase();

      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: `HomeNameIndex-${process.env.STAGE!}`,
        KeyConditionExpression: "#homeName = :homeName",
        ExpressionAttributeNames: {
          "#homeName": "homeName",
        },
        ExpressionAttributeValues: {
          ":homeName": { S: homeName },
        },
      });
      const response = await dynamoClient.send(command);
      return response?.Items && response.Items.length
        ? decryptUserData(unmarshall(response.Items[0]))
        : {};
    } catch (error) {
      console.error("Error fetching home by homeName:", error);
      throw error;
    }
  }

  async upsertHome(home: z.infer<typeof HomeSchema>) {
    //Convert homeName to lowercase for consistency
    home = { ...home, homeName: home.homeName.toLowerCase() };

    const encryptedHome = encryptUserData(home, this.excludeFields);

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(encryptedHome),
    });

    try {
      await dynamoClient.send(command);
      return encryptedHome;
    } catch (error) {
      console.error("Error upserting home:", error);
      throw error;
    }
  }

  async getHomeById(homeId: string) {
    try {
      const command = new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ homeId }),
      });
      const response = await dynamoClient.send(command);
      return response.Item ? decryptUserData(unmarshall(response.Item)) : {};
    } catch (error) {
      console.error("Error fetching home by homeId:", error);
      throw error;
    }
  }

  async batchFetchHomesByIds(homeIds: string[]) {
    if (homeIds.length === 0) return [];

    const keys = homeIds.map((id) => marshall({ homeId: id }));

    const command = new BatchGetItemCommand({
      RequestItems: {
        [this.tableName]: {
          Keys: keys,
        },
      },
    });

    const response = await dynamoClient.send(command);
    const items = response.Responses?.[this.tableName] ?? [];

    return items.map((item) => decryptUserData(unmarshall(item)));
  }
}
