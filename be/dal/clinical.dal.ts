import { GetItemCommand, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { dynamoClient } from '../utils/dynamo-client';
import { decryptUserData, encryptUserData } from '../utils/crypto-util';

export class ClinicalDAL {
  private tableName: string;
  private readonly excludeFields: Set<string>;

  constructor() {
    this.tableName = process.env.CLINICAL_TABLE_NAME!;
    this.excludeFields = new Set(['userId']);
  }

  /**
   * Inserts a new clinical data  into DynamoDB with encrypted data.
   * @param clinical The user object to insert.
   */
  // async inserClinicalData(clinical: any) {
  //   const encryptedClinical = encryptUserData(clinical, this.excludeFields);

  //   const command = new PutItemCommand({
  //     TableName: this.tableName,
  //     Item: marshall(encryptedClinical),
  //   });

  //   try {
  //     await dynamoClient.send(command);
  //   } catch (error) {
  //     console.error("Error inserting user:", error);
  //     throw error;
  //   }
  // }

  /**
   * Fetches a user by their userId.
   * @param userId The user's unique identifier.
   * @returns The user object if found, otherwise an empty object.
   */
  async fetchClinicalByUserId(userId: string) {
    try {
      const command = new GetItemCommand({
        TableName: this.tableName,
        Key: marshall({ userId }),
      });
      const response = await dynamoClient.send(command);
      return response.Item ? decryptUserData(unmarshall(response.Item)) : {};
    } catch (error) {
      console.error('Error querying user by userId:', error);
      throw error;
    }
  }

  /**
   * Updates an existing user in DynamoDB with encrypted data.
   * @param newClinicalData The updated user data.
   */
  async updateClinical(newClinicalData: any) {
    const encryptedClinical = encryptUserData(newClinicalData, this.excludeFields, true);

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(encryptedClinical),
    });

    try {
      await dynamoClient.send(command);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }
}
