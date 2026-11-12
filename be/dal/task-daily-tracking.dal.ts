import { z } from 'zod';
import { getPostgresConnection } from '../utils/postgres-client';
import {
  CreateTaskDailyTrackingSchema,
  UpdateTaskDailyTrackingSchema,
} from '../models/HCM/task.model';

export class TaskDailyTrackingDAL {
  private trackingTableName: string;

  constructor() {
    this.trackingTableName = `task_daily_tracking_${process.env.STAGE!}`;
  }

  public async createTracking(trackingData: z.infer<typeof CreateTaskDailyTrackingSchema>) {
    try {
      const postgresDB = await getPostgresConnection();

      const [created] = await postgresDB(this.trackingTableName)
        .insert({
          ...trackingData,
          comments: JSON.stringify(trackingData.comments),
          updated_at: new Date().toISOString(),
        })
        .returning('*');

      return created;
    } catch (error) {
      console.error(`path: task-daily-tracking.dal, method: createTracking, error: ${error}`);
      throw error;
    }
  }

  public async getTrackingByTaskAndDate(taskId: string, date: string) {
    try {
      const postgresDB = await getPostgresConnection();
      return await postgresDB(this.trackingTableName)
        .where('task_id', taskId)
        .andWhere('date', date)
        .first();
    } catch (error) {
      console.error(
        `path: task-daily-tracking.dal, method: getTrackingByTaskAndDate, error: ${error}`
      );
      throw error;
    }
  }

  public async getTrackingByHomeAndDate(homeId: string, date: string) {
    try {
      const postgresDB = await getPostgresConnection();
      return await postgresDB(this.trackingTableName)
        .where('home_id', homeId)
        .andWhere('date', date)
        .orderBy('created_at', 'asc');
    } catch (error) {
      console.error(
        `path: task-daily-tracking.dal, method: getTrackingByHomeAndDate, error: ${error}`
      );
      throw error;
    }
  }

  public async updateTrackingById(
    id: string,
    patch: Partial<z.infer<typeof UpdateTaskDailyTrackingSchema>>
  ) {
    try {
      const postgresDB = await getPostgresConnection();

      const updateData: Record<string, any> = {
        ...patch,
        updated_at: new Date().toISOString(),
      };

      if (patch.comments) {
        updateData.comments = JSON.stringify(patch.comments);
      }

      const [updated] = await postgresDB(this.trackingTableName)
        .where('id', id)
        .update(updateData)
        .returning('*');

      return updated ?? null;
    } catch (error) {
      console.error(`path: task-daily-tracking.dal, method: updateTrackingById, error: ${error}`);
      throw error;
    }
  }
}
