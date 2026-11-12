import { z } from 'zod';
import { TaskDAL } from '../../dal/task.dal';
import { FormatResponse } from '../../utils/response-formatter';
import { CreateTaskSchema } from '../../models/HCM/task.model';

const taskDAL: TaskDAL = new TaskDAL();

export const createTaskHandler = async (requestPayload: any) => {
  try {
    if (!requestPayload || Object.keys(requestPayload).length === 0) {
      console.error(`{api: '/create-task', error: 'No body provided'}`);

      return FormatResponse(400, {
        message: 'Failed to create task',
        error: 'No body provided',
      });
    }

    const validatedData = CreateTaskSchema.parse(requestPayload);
    const createdTask = await taskDAL.createTask(validatedData);

    return FormatResponse(201, {
      message: 'Task created successfully',
      task: createdTask,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`{api: '/create-task', error: ${JSON.stringify(error.errors)}}`);

      return FormatResponse(400, {
        message: 'Failed to create task',
        error: error.errors,
      });
    }

    console.error(`{api: '/create-task', error: ${error}}`);

    return FormatResponse(500, {
      message: 'Failed to create task',
      error: error as Error,
    });
  }
};
