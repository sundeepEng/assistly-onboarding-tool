import { TaskDAL } from '../../dal/task.dal';
import { FormatResponse } from '../../utils/response-formatter';

const taskDAL: TaskDAL = new TaskDAL();

export const deleteTaskHandler = async (taskId: string | undefined) => {
  try {
    if (!taskId) {
      return FormatResponse(400, {
        message: 'Failed to delete task',
        error: 'No taskId provided',
      });
    }

    const deleted = await taskDAL.softDeleteTask(taskId);

    if (!deleted) {
      return FormatResponse(404, {
        message: 'Failed to delete task',
        error: `Task with id ${taskId} not found`,
      });
    }

    return FormatResponse(200, {
      message: 'Task deleted successfully',
      task: deleted,
    });
  } catch (error) {
    console.error(`{api: '/task/{id}', error: ${error}}`);
    return FormatResponse(500, {
      message: 'Failed to delete task',
      error: error as Error,
    });
  }
};
