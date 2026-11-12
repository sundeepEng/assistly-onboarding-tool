import { z } from 'zod';
import { TaskDAL } from '../../dal/task.dal';
import { TaskDailyTrackingDAL } from '../../dal/task-daily-tracking.dal';
import { FormatResponse } from '../../utils/response-formatter';
import { CreateTaskDailyTrackingSchema } from '../../models/HCM/task.model';

const taskDAL: TaskDAL = new TaskDAL();
const trackingDAL: TaskDailyTrackingDAL = new TaskDailyTrackingDAL();

const UpsertTaskDailyTrackingSchema = CreateTaskDailyTrackingSchema.omit({
  home_id: true,
  created_at: true,
  updated_at: true,
})
  .partial({ status: true, comments: true, updated_by_user_id: true })
  .strict();

export const upsertTaskDailyTrackingHandler = async (requestPayload: any) => {
  try {
    if (!requestPayload || Object.keys(requestPayload).length === 0) {
      return FormatResponse(400, {
        message: 'Failed to update task tracking',
        error: 'No body provided',
      });
    }

    const validatedData = UpsertTaskDailyTrackingSchema.parse(requestPayload);

    const task = await taskDAL.getTaskById(validatedData.task_id);

    if (!task || task.is_deleted) {
      return FormatResponse(404, {
        message: 'Failed to update task tracking',
        error: `Task with id ${validatedData.task_id} not found`,
      });
    }

    const existing = await trackingDAL.getTrackingByTaskAndDate(
      validatedData.task_id,
      validatedData.date
    );

    if (existing) {
      const existingComments = Array.isArray(existing.comments)
        ? existing.comments
        : JSON.parse(existing.comments ?? '[]');

      const updated = await trackingDAL.updateTrackingById(existing.id, {
        ...(validatedData.updated_by_user_id && {
          updated_by_user_id: validatedData.updated_by_user_id,
        }),
        ...(validatedData.status && { status: validatedData.status }),
        ...(validatedData.comments && {
          comments: [...existingComments, ...validatedData.comments],
        }),
      });

      return FormatResponse(200, {
        message: 'Task tracking updated successfully',
        tracking: updated,
      });
    }

    const created = await trackingDAL.createTracking({
      task_id: validatedData.task_id,
      home_id: task.home_id,
      date: validatedData.date,
      updated_by_user_id:
        validatedData.updated_by_user_id ??
        validatedData.comments?.[0]?.user_id ??
        task.assigned_to_user_id ??
        task.created_by_user_id,
      status: validatedData.status ?? 'pending',
      comments: validatedData.comments ?? [],
    });

    return FormatResponse(201, {
      message: 'Task tracking created successfully',
      tracking: created,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`{api: '/task-daily-tracking', error: ${JSON.stringify(error.errors)}}`);

      return FormatResponse(400, {
        message: 'Failed to update task tracking',
        error: error.errors,
      });
    }

    console.error(`{api: '/task-daily-tracking', error: ${error}}`);

    return FormatResponse(500, {
      message: 'Failed to update task tracking',
      error: error as Error,
    });
  }
};
