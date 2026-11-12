import { z } from "zod";
import { TeamRoasterSchema } from "../models/HCM/team-roaster.model";
import { getPostgresConnection } from "../utils/postgres-client";

export class TeamRoasterDAL {
  public tableName: string;
  constructor() {
    this.tableName = `team_roaster_${process.env.STAGE!}`;
  }

  /**
   * Upserts roaster entry for a given user.
   * @param {z.infer<typeof CreateTeamRoasterSchema> | z.infer<typeof UpdateTeamRoasterSchema>} roasterData - The roaster data to be upserted.
   * @returns.
   * @throws {Error} If there is an error during the database query.
   */
  async UpsertTeamRoaster(roasterData: z.infer<typeof TeamRoasterSchema>) {
    try {
      const postgresDB = await getPostgresConnection();
      const newRoaster = await postgresDB(this.tableName)
        .insert(roasterData)
        .onConflict("user_id")
        .merge()
        .returning("*");

      return newRoaster;
    } catch (err) {
      console.error(`TeamRoaster DAL, error: ${err}`);
      throw err;
    }
  }

  /**
   * Fetches all roaster entries for all users.
   * @returns {Promise<z.infer<typeof TeamRoasterSchema>[]>} - An array of roaster entries.
   * @throws {Error} If there is an error during the database query.
   */
  async getTeamRoaster(
    filters?: Partial<z.infer<typeof TeamRoasterSchema>>
  ) {
    try {
      const postgresDB = await getPostgresConnection();
      const query = postgresDB(this.tableName).select("*");
      if (filters?.user_id) {
        if (Array.isArray(filters.user_id)) {
          query.whereIn("user_id", filters.user_id);
        } else {
          query.where("user_id", filters.user_id);
        }
      }
      if (filters?.work_status) {
        query.where("work_status", filters.work_status);
      }
      return await query.orderBy("created_at", "asc");
    } catch (err) {
      console.error(`TeamRoaster DAL, error: ${err}`);
      throw err;
    }
  }
}
