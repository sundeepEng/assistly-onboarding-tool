import { z } from 'zod';
import { TaskDAL } from '../../dal/task.dal';
import { FormatResponse } from '../../utils/response-formatter';
import { UpdateTaskSchema } from '../../models/HCM/task.model';

const taskDAL: TaskDAL = new TaskDAL();

const UpdateTaskPayloadSchema = UpdateTaskSchema.partial().required({ id: true });

export const updateTaskHandler = async (taskId: string | undefined, requestPayload: any) => {
  try {
    if (!taskId || !requestPayload || Object.keys(requestPayload).length === 0) {
      return FormatResponse(400, {
        message: 'Failed to update task',
        error: 'No task ID or body provided',
      });
    }

    const validatedData = UpdateTaskPayloadSchema.parse(requestPayload);

    if (taskId !== validatedData.id) {
      return FormatResponse(400, {
        message: 'Failed to update task',
        error: 'Task ID in path does not match task ID in body',
      });
    }

    const { id, ...patch } = validatedData;
    const updated = await taskDAL.updateTaskById(id, patch as any);

    if (!updated) {
      return FormatResponse(404, {
        message: 'Failed to update task',
        error: `Task with id ${id} not found`,
      });
    }

    return FormatResponse(200, {
      message: 'Task updated successfully',
      task: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return FormatResponse(400, {
        message: 'Failed to update task',
        error: error.errors,
      });
    }

    console.error(`{api: '/task/{id}', error: ${error}}`);
    return FormatResponse(500, {
      message: 'Failed to update task',
      error: error as Error,
    });
  }
};
