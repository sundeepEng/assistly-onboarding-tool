import {
  TeamConversationMessagesSchema,
  TeamConversationsSchema,
} from "../models/HCM/team-communication.model";
import { getPostgresConnection } from "../utils/postgres-client";
import { z } from "zod";

export class TeamCommunicationDAL {
  private conversationsTableName: string;
  private conversationMessagesTableName: string;

  constructor() {
    this.conversationsTableName = `team_conversations_${process.env.STAGE!}`;
    this.conversationMessagesTableName = `team_conversation_messages_${process
      .env.STAGE!}`;
  }

  async upsertConversation(
    conversation: z.infer<typeof TeamConversationsSchema>
  ) {
    try {
      const postgresDB = await getPostgresConnection();

      const result = await postgresDB
        .table(this.conversationsTableName)
        .insert(conversation)
        .onConflict("conversation_id")
        .merge()
        .returning("*");

      return result;
    } catch (error) {
      console.error(
        "DAL - Error in Conversation Upsert",
        JSON.stringify(error)
      );

      throw error as Error;
    }
  }
  async getUserConversations(userId: string, homeId: string) {
    try {
      const postgresDB = await getPostgresConnection();

      const result = await postgresDB
        .table(this.conversationsTableName)
        .select("*")
        .where("sender_user_id", userId)
        .orWhere("receiver_user_id", userId)
        .andWhere("home_id", homeId)
        .orderBy("updated_at", "desc");

      return result;
    } catch (error) {
      console.error("DAL - Error in fetching user conversations");

      throw error as Error;
    }
  }

  async getConversationById(conversationId: string) {
    try {
      const postgresDB = await getPostgresConnection();

      const result = await postgresDB
        .table(this.conversationsTableName)
        .select("*")
        .where("conversation_id", conversationId)
        .first();

      return result;
    } catch (error) {
      console.error(
        "DAL - Error in fetching conversation",
        JSON.stringify(error)
      );

      throw error as Error;
    }
  }
  
  async updateConversation(conversationId: String) {
    try {
      const postgresDB = await getPostgresConnection();

      const result = await postgresDB
        .table(this.conversationsTableName)
        .where("conversation_id", conversationId)
        .update({
          updated_at: new Date().toISOString(),
        })
        .returning("*");

      return result;
    } catch (error) {
      console.error(
        "DAL - Error in Conversation Upsert",
        JSON.stringify(error)
      );

      throw error as Error;
    }
  }

  async duplicateConversation(senderUserId: string, receiverUserId: string) {
    try {
      const postgresDB = await getPostgresConnection();

      const result = await postgresDB
        .table(this.conversationsTableName)
        .select("*")
        .where((builder) => {
          builder
            .where((subQuery) => {
              subQuery
                .where("sender_user_id", senderUserId)
                .andWhere("receiver_user_id", receiverUserId);
            })
            .orWhere((subQuery) => {
              subQuery
                .where("sender_user_id", receiverUserId)
                .andWhere("receiver_user_id", senderUserId);
            });
        })
        .first();

      return result;
    } catch (error) {
      console.error(
        "DAL - Error in Conversation Upsert",
        JSON.stringify(error)
      );

      throw error as Error;
    }
  }

  async upsertMessage(
    message: z.infer<typeof TeamConversationMessagesSchema>
    // | z.infer<typeof TeamConversationMessagesSchema>[]
  ) {
    try {
      const postgresDB = await getPostgresConnection();

      const result = await postgresDB
        .table(this.conversationMessagesTableName)
        .insert(message)
        .onConflict("message_id")
        .merge()
        .returning("*");

      return result;
    } catch (error) {
      console.error("DAL - Error in Message Upsert", JSON.stringify(error));

      throw error as Error;
    }
  }
  async getConversationMessages(conversationId: string) {
    try {
      const postgresDB = await getPostgresConnection();

      const result = await postgresDB
        .table(this.conversationMessagesTableName)
        .select("*")
        .where("conversation_id", conversationId)
        .orderBy("created_at", "desc");

      return result;
    } catch (error) {
      console.error(
        "DAL - Error in Fetching Conversation Messages",
        JSON.stringify(error)
      );

      throw error as Error;
    }
  }
}
