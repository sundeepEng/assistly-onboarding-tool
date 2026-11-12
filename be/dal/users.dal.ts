import {
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  BatchGetItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { dynamoClient } from '../utils/dynamo-client';
import { decryptUserData, encryptUserData } from '../utils/crypto-util';

export class UsersDAL {
  private tableName: string;
  private readonly excludeFields: Set<string>;

  constructor() {
    this.tableName = process.env.USERS_TABLE_NAME!;
    this.excludeFields = new Set([
      'role',
      'home',
      'homeId',
      'name',
      'email',
      'createdAt',
      'modifiedAt',
      'milestone',
      'userId',
      'lastLoginTimestamp',
    ]);
  }

  /**
   * Retrieves a user by email.
   * @param email The user's email.
   * @returns An array of user objects matching the email.
   */
  async getUserByEmail(email: string) {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: `EmailIndex-${process.env.STAGE!}`,
      KeyConditionExpression: '#email = :email',
      ExpressionAttributeNames: {
        '#email': 'email',
      },
      ExpressionAttributeValues: {
        ':email': { S: email },
      },
    });

    const response = await dynamoClient.send(command);
    return response?.Items ? response?.Items?.map((item) => decryptUserData(unmarshall(item))) : [];
  }

  /**
   * Fetches all users based on role and home.
   * @param role The user's role.
   * @param home The user's home.
   * @returns An array of user objects matching the criteria.
   */
  async fetchAllUsers(role: string, home: string) {
    const params = {
      TableName: this.tableName,
      IndexName: `RoleHomeIndex-${process.env.STAGE!}`,
      KeyConditionExpression: '#roleKey = :role AND #homeKey = :home',
      ExpressionAttributeNames: {
        '#roleKey': 'role',
        '#homeKey': 'home',
      },
      ExpressionAttributeValues: {
        ':role': { S: role },
        ':home': { S: home },
      },
    };

    try {
      const command = new QueryCommand(params);
      const response = await dynamoClient.send(command);
      return response.Items?.map((item) => decryptUserData(unmarshall(item))) || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  async fetchAllUsersByRole(role: string) {
    const params = {
      TableName: this.tableName,
      FilterExpression: '#roleKey = :role',
      ExpressionAttributeNames: {
        '#roleKey': 'role',
      },
      ExpressionAttributeValues: {
        ':role': { S: role },
      },
    };

    try {
      const allItems: any[] = [];
      let lastEvaluatedKey: any = undefined;

      do {
        const command = new ScanCommand({
          ...params,
          ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {}),
        });
        const response = await dynamoClient.send(command);
        if (response.Items?.length) {
          allItems.push(...response.Items);
        }
        lastEvaluatedKey = response.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      return allItems.map((item) => decryptUserData(unmarshall(item)));
    } catch (error) {
      console.error('Error fetching users by role:', error);
      throw error;
    }
  }

  async fetchAllUsersWithHomeId(role: string, homeId: string) {
    const params = {
      TableName: this.tableName,
      IndexName: `RoleHomeIdIndex-${process.env.STAGE!}`,
      KeyConditionExpression: '#roleKey = :role AND #homeIdKey = :homeId',
      ExpressionAttributeNames: {
        '#roleKey': 'role',
        '#homeIdKey': 'homeId',
      },
      ExpressionAttributeValues: {
        ':role': { S: role },
        ':homeId': { S: homeId },
      },
    };

    try {
      const command = new QueryCommand(params);
      const response = await dynamoClient.send(command);
      return response.Items?.map((item) => decryptUserData(unmarshall(item))) || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  async countActiveUsersByHomeAndRole(role: string, homeId: string): Promise<number> {
    try {
      const users = await this.fetchAllUsersWithHomeId(role, homeId);
      return users.filter((user: any) => user?.isDeleted !== true).length;
    } catch (error) {
      console.error('Error counting active users:', error);
      throw error;
    }
  }

  async fetchAllUsersByAssociatedHomeId(role: string, homeId: string) {
    const params = {
      TableName: this.tableName,
      FilterExpression: '#roleKey = :role AND contains(#associatedHomeIdsKey, :homeId)',
      ExpressionAttributeNames: {
        '#roleKey': 'role',
        '#associatedHomeIdsKey': 'associatedHomeIds',
      },
      ExpressionAttributeValues: {
        ':role': { S: role },
        ':homeId': { S: homeId },
      },
    };

    try {
      const command = new ScanCommand(params);
      const response = await dynamoClient.send(command);
      return response.Items?.map((item) => decryptUserData(unmarshall(item))) || [];
    } catch (error) {
      console.error('Error fetching users by associatedHomeIds:', error);
      throw error;
    }
  }

  /**
   * Inserts a new user into DynamoDB with encrypted data.
   * @param user The user object to insert.
   */
  async insertUser(user: any) {
    const encryptedUser = encryptUserData(user, this.excludeFields);

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(encryptedUser),
    });

    try {
      await dynamoClient.send(command);
    } catch (error) {
      console.error('Error inserting user:', error);
      throw error;
    }
  }

  /**
   * Fetches a user by their userId.
   * @param userId The user's unique identifier.
   * @returns The user object if found, otherwise an empty object.
   */
  async fetchUserById(userId: string) {
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
   * @param newUserData The updated user data.
   */
  async updateUser(newUserData: any) {
    const encryptedUser = encryptUserData(newUserData, this.excludeFields);

    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall(encryptedUser),
    });

    try {
      await dynamoClient.send(command);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Deletes the user based on userId provided
   * @param userId The user's unique identifier
   * @returns The user object if deleted, else error
   */
  async deleteUser(userId: string) {
    try {
      const command = new DeleteItemCommand({
        TableName: this.tableName,
        Key: marshall({ userId }),
        ReturnValues: 'ALL_OLD', // This will return the deleted item
      });

      const response = await dynamoClient.send(command);

      return response.Attributes ? decryptUserData(unmarshall(response.Attributes)) : {};
    } catch (error) {
      console.error('Error deleting user:', error);

      throw error;
    }
  }

  /**
   * Checks if a referral with the same email already exists in the same homeId
   * @param email The referral's email
   * @param homeId The referral's homeId
   * @returns Array of existing referrals with the same email in the same homeId
   */
  async getReferralByEmailAndHomeId(email: string, homeId: string) {
    const command = new QueryCommand({
      TableName: this.tableName,
      IndexName: `EmailIndex-${process.env.STAGE!}`,
      KeyConditionExpression: '#email = :email',
      FilterExpression: '#role = :role AND #homeId = :homeId',
      ExpressionAttributeNames: {
        '#email': 'email',
        '#role': 'role',
        '#homeId': 'homeId',
      },
      ExpressionAttributeValues: {
        ':email': { S: email },
        ':role': { S: 'Referral' },
        ':homeId': { S: homeId },
      },
    });

    const response = await dynamoClient.send(command);
    return response?.Items ? response?.Items?.map((item) => decryptUserData(unmarshall(item))) : [];
  }

  /**
   * Batch fetches the names of corresponding userIds provided
   * @param userId Array of userId's of type string
   * @returns The user objects of the provided userId's
   */
  async batchFetchUsersByIds(userIds: string[]) {
    if (userIds.length === 0) return [];

    const keys = userIds.map((id) => marshall({ userId: id }));

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
