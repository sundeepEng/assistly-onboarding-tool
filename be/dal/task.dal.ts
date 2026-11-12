import { z } from 'zod';
import { getPostgresConnection } from '../utils/postgres-client';
import { CreateTaskSchema, UpdateTaskSchema } from '../models/HCM/task.model';

export class TaskDAL {
  private taskTableName: string;

  constructor() {
    this.taskTableName = `tasks_${process.env.STAGE!}`;
  }

  public async createTask(taskData: z.infer<typeof CreateTaskSchema>) {
    try {
      const postgresDB = await getPostgresConnection();

      const [created] = await postgresDB(this.taskTableName)
        .insert({
          ...taskData,
          days_of_week: JSON.stringify(taskData.days_of_week),
          shift_notes: taskData.shift_notes ?? null,
          assigned_to_user_id: taskData.assigned_to_user_id ?? null,
          updated_at: new Date().toISOString(),
        })
        .returning('*');

      return created;
    } catch (error) {
      console.error(`path: task.dal, method: createTask, error: ${error}`);
      throw error;
    }
  }

  public async getAllTasks(filters?: Partial<z.infer<typeof UpdateTaskSchema>>) {
    try {
      const postgresDB = await getPostgresConnection();
      const query = postgresDB(this.taskTableName).select('*');

      if (filters?.id) {
        Array.isArray(filters.id) ? query.whereIn('id', filters.id) : query.where('id', filters.id);
      }

      if (filters?.home_id) {
        Array.isArray(filters.home_id)
          ? query.whereIn('home_id', filters.home_id)
          : query.where('home_id', filters.home_id);
      }

      if (filters?.title) {
        Array.isArray(filters.title)
          ? query.whereIn('title', filters.title)
          : query.whereILike('title', `%${filters.title}%`);
      }

      if (filters?.type) {
        Array.isArray(filters.type)
          ? query.whereIn('type', filters.type)
          : query.where('type', filters.type);
      }

      if (filters?.shift) {
        Array.isArray(filters.shift)
          ? query.whereIn('shift', filters.shift)
          : query.where('shift', filters.shift);
      }

      if (filters?.shift_notes) {
        Array.isArray(filters.shift_notes)
          ? query.whereIn('shift_notes', filters.shift_notes)
          : query.whereILike('shift_notes', `%${filters.shift_notes}%`);
      }

      if (filters?.days_of_week != null) {
        const days = filters.days_of_week as unknown;
        if (Array.isArray(days)) {
          query.whereRaw('days_of_week ?| ?', [days]);
        } else {
          query.whereRaw('days_of_week @> ?', [JSON.stringify([days])]);
        }
      }

      if (filters?.assigned_to_user_id) {
        Array.isArray(filters.assigned_to_user_id)
          ? query.whereIn('assigned_to_user_id', filters.assigned_to_user_id)
          : query.where('assigned_to_user_id', filters.assigned_to_user_id);
      }

      if (filters?.is_deleted != null) {
        const toBoolean = (value: unknown) =>
          typeof value === 'string' ? value === 'true' : Boolean(value);
        Array.isArray(filters.is_deleted)
          ? query.whereIn('is_deleted', (filters.is_deleted as unknown[]).map(toBoolean))
          : query.where('is_deleted', toBoolean(filters.is_deleted));
      } else {
        query.where('is_deleted', false);
      }

      if (filters?.created_by_user_id) {
        Array.isArray(filters.created_by_user_id)
          ? query.whereIn('created_by_user_id', filters.created_by_user_id)
          : query.where('created_by_user_id', filters.created_by_user_id);
      }

      if (filters?.created_at != null) {
        const createdAt = filters.created_at as unknown;
        if (Array.isArray(createdAt)) {
          query.whereBetween('created_at', [createdAt[0] as any, createdAt[1] as any]);
        } else {
          query.where('created_at', createdAt as any);
        }
      }

      if (filters?.updated_at != null) {
        const updatedAt = filters.updated_at as unknown;
        if (Array.isArray(updatedAt)) {
          query.whereBetween('updated_at', [updatedAt[0] as any, updatedAt[1] as any]);
        } else {
          query.where('updated_at', updatedAt as any);
        }
      }

      return await query.orderBy('created_at', 'desc');
    } catch (error) {
      console.error(`path: task.dal, method: getAllTasks, error: ${error}`);
      throw error;
    }
  }

  public async getTaskById(id: string) {
    try {
      const postgresDB = await getPostgresConnection();
      return await postgresDB(this.taskTableName).where('id', id).first();
    } catch (error) {
      console.error(`path: task.dal, method: getTaskById, error: ${error}`);
      throw error;
    }
  }

  public async updateTaskById(id: string, patch: Partial<z.infer<typeof UpdateTaskSchema>>) {
    try {
      const postgresDB = await getPostgresConnection();

      const updateData: Record<string, any> = {
        ...patch,
        updated_at: new Date().toISOString(),
      };

      if (patch.days_of_week) {
        updateData.days_of_week = JSON.stringify(patch.days_of_week);
      }

      const [updated] = await postgresDB(this.taskTableName)
        .where('id', id)
        .update(updateData)
        .returning('*');

      return updated ?? null;
    } catch (error) {
      console.error(`path: task.dal, method: updateTaskById, error: ${error}`);
      throw error;
    }
  }

  public async softDeleteTask(id: string) {
    return this.updateTaskById(id, { is_deleted: true });
  }
}
