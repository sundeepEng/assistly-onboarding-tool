import { TeamBroadcastSchema } from "../models/HCM/team-broadcast.model";
import { getPostgresConnection } from "../utils/postgres-client";
import { z } from "zod";

export class TeamBroadcastDAL {
  private tableName: string;

  constructor() {
    this.tableName = `team_broadcast_${process.env.STAGE!}`;
  }

  async getAllBroadcasts(
    filters?: Partial<z.infer<typeof TeamBroadcastSchema>>
  ) {
    try {
      const postgresDB = await getPostgresConnection();
      const query = postgresDB(this.tableName).select("*");

      //#region Filters
      if (filters?.home_id) {
        if (Array.isArray(filters.home_id)) {
          query.whereIn("home_id", filters.home_id);
        } else {
          query.where("home_id", filters.home_id);
        }
      }

      if (filters?.sender_user_id) {
        if (Array.isArray(filters.sender_user_id)) {
          query.whereIn("sender_user_id", filters.sender_user_id);
        } else {
          query.where("sender_user_id", filters.sender_user_id);
        }
      }
      //#endregion

      return await query.orderBy("created_at", "desc");
    } catch (error) {
      console.info(
        "Error in getAllBroadcasts:",
        JSON.stringify(error as Error)
      );

      throw error as Error;
    }
  }

  async createBroadcast(
    message: Record<string, any>
  ): Promise<z.infer<typeof TeamBroadcastSchema>[]> {
    try {
      const postgresDB = await getPostgresConnection();

      const newBroadcast = await postgresDB(this.tableName)
        .insert(message)
        .returning("*");

      return newBroadcast;
    } catch (error) {
      console.info(
        "Error in createBroadcast: ",
        JSON.stringify(error as Error)
      );

      throw error as Error;
    }
  }
}
