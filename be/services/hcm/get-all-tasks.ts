import { TaskDAL } from '../../dal/task.dal';
import { UsersDAL } from '../../dal/users.dal';
import { FormatResponse } from '../../utils/response-formatter';

const taskDAL: TaskDAL = new TaskDAL();
const usersDAL: UsersDAL = new UsersDAL();

export const getAllTasksHandler = async (queryParams?: any) => {
  try {
    const allTasks =
      queryParams && Object.keys(queryParams).length > 0
        ? await taskDAL.getAllTasks(queryParams)
        : await taskDAL.getAllTasks();

    const uniqueUserIds = Array.from(
      new Set(
        allTasks.flatMap((task: any) =>
          task.assigned_to_user_id
            ? [task.created_by_user_id, task.assigned_to_user_id]
            : [task.created_by_user_id]
        )
      )
    );

    const users = await usersDAL.batchFetchUsersByIds(uniqueUserIds);

    const userMap = new Map<string, { name?: string; profileImageUrl?: string }>(
      users.map((u: any) => [u.userId, { name: u.name, profileImageUrl: u.profileImageUrl }])
    );

    const enrichedTasks = allTasks.map((task: any) => ({
      ...task,
      created_by_user_name: userMap.get(task.created_by_user_id)?.name ?? '',
      ...(task.assigned_to_user_id && {
        assigned_to_user_name: userMap.get(task.assigned_to_user_id)?.name ?? '',
        assigned_to_user_profile_image_url:
          userMap.get(task.assigned_to_user_id)?.profileImageUrl ?? '',
      }),
    }));

    return FormatResponse(200, {
      message: 'Tasks fetched successfully',
      tasks: enrichedTasks,
    });
  } catch (error) {
    console.error(`{api: '/get-all-tasks', error: ${error}}`);

    return FormatResponse(500, {
      message: 'Failed to fetch tasks',
      error: error as Error,
    });
  }
};
