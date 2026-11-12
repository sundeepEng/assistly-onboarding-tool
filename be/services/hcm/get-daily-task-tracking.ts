import { z } from 'zod';
import { TaskDAL } from '../../dal/task.dal';
import { TaskDailyTrackingDAL } from '../../dal/task-daily-tracking.dal';
import { UserShiftsDAL } from '../../dal/user-shifts.dal';
import { UsersDAL } from '../../dal/users.dal';
import { FormatResponse } from '../../utils/response-formatter';
import { WeekdaySchema } from '../../models/HCM/task.model';
import { UserTypes } from '../../utils/constants';

const taskDAL: TaskDAL = new TaskDAL();
const trackingDAL: TaskDailyTrackingDAL = new TaskDailyTrackingDAL();
const userShiftsDAL: UserShiftsDAL = new UserShiftsDAL();
const usersDAL: UsersDAL = new UsersDAL();

const GetDailyTaskTrackingQuerySchema = z.object({
  home_id: z.string().uuid({ message: 'home_id must be a valid uuid' }),
  date: z.string().date('date must be a valid YYYY-MM-DD date string'),
  user_id: z.string().uuid({ message: 'user_id must be a valid uuid' }),
  morning_start: z.string().datetime().optional(),
  morning_end: z.string().datetime().optional(),
  afternoon_end: z.string().datetime().optional(),
  evening_end: z.string().datetime().optional(),
});

const WEEKDAYS: z.infer<typeof WeekdaySchema>[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getAllowedShiftsFromUserShifts = (
  shifts: any[],
  date: string,
  boundaries?: {
    morning_start?: string;
    morning_end?: string;
    afternoon_end?: string;
    evening_end?: string;
  }
): string[] => {
  const [year, month, day] = date.split('-').map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDateStr = [
    nextDay.getUTCFullYear(),
    String(nextDay.getUTCMonth() + 1).padStart(2, '0'),
    String(nextDay.getUTCDate()).padStart(2, '0'),
  ].join('-');

  const morningStart = new Date(boundaries?.morning_start ?? `${date}T11:00:00Z`).getTime();
  const morningEnd = new Date(boundaries?.morning_end ?? `${date}T17:00:00Z`).getTime();
  const afternoonEnd = new Date(boundaries?.afternoon_end ?? `${date}T23:00:00Z`).getTime();
  const eveningEnd = new Date(boundaries?.evening_end ?? `${nextDateStr}T11:00:00Z`).getTime();
  const afternoonStart = morningEnd;
  const eveningStart = afternoonEnd;

  const allowed = new Set<string>();
  for (const shift of shifts) {
    const shiftStart = new Date(shift.shift_start_time).getTime();
    const shiftEnd = new Date(shift.shift_end_time).getTime();

    if (shiftStart < morningEnd && shiftEnd > morningStart) allowed.add('morning');
    if (shiftStart < afternoonEnd && shiftEnd > afternoonStart) allowed.add('afternoon');
    if (shiftStart < eveningEnd && shiftEnd > eveningStart) allowed.add('evening');
  }
  return Array.from(allowed);
};

export const getDailyTaskTrackingHandler = async (queryParams?: any) => {
  try {
    const { home_id, date, user_id, morning_start, morning_end, afternoon_end, evening_end } =
      GetDailyTaskTrackingQuerySchema.parse(queryParams ?? {});

    const [year, month, day] = date.split('-').map(Number);
    const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

    const [user, userShifts, tasks, trackingRows] = await Promise.all([
      usersDAL.fetchUserById(user_id),
      userShiftsDAL.getAllShifts({
        user_id,
        home_id,
        shift_status: 'available',
        shift_start_time: date,
        shift_end_time: date,
      } as any),
      taskDAL.getAllTasks({ home_id, days_of_week: weekday } as any),
      trackingDAL.getTrackingByHomeAndDate(home_id, date),
    ]);

    if (Object.keys(user ?? {}).length === 0) {
      return FormatResponse(404, {
        message: 'Failed to fetch daily task review',
        error: `User not found with userId - ${user_id}`,
      });
    }

    let filteredTasks = tasks;
    if (user.role === UserTypes.PCG) {
      const allowedShifts = getAllowedShiftsFromUserShifts(userShifts, date, {
        morning_start,
        morning_end,
        afternoon_end,
        evening_end,
      });
      filteredTasks = tasks.filter((task: any) => allowedShifts.includes(task.shift));
    }

    const trackingByTaskId = new Map<string, any>(
      trackingRows.map((row: any) => [row.task_id, row])
    );

    const commentUserIds = trackingRows.flatMap((row: any) => {
      const comments = Array.isArray(row.comments) ? row.comments : [];
      return comments.map((comment: any) => comment?.user_id);
    });

    const uniqueUserIds = Array.from(
      new Set(
        [
          ...filteredTasks.flatMap((task: any) =>
            task.assigned_to_user_id
              ? [task.created_by_user_id, task.assigned_to_user_id]
              : [task.created_by_user_id]
          ),
          ...trackingRows.map((row: any) => row.updated_by_user_id),
          ...commentUserIds,
        ].filter(Boolean)
      )
    );

    const users = await usersDAL.batchFetchUsersByIds(uniqueUserIds);

    const userMap = new Map<string, { name?: string; profileImageUrl?: string }>(
      users.map((u: any) => [u.userId, { name: u.name, profileImageUrl: u.profileImageUrl }])
    );

    const dailyReview = filteredTasks.map((task: any) => {
      const tracking = trackingByTaskId.get(task.id);

      return {
        ...task,
        created_by_user_name: userMap.get(task.created_by_user_id)?.name ?? '',
        ...(task.assigned_to_user_id && {
          assigned_to_user_name: userMap.get(task.assigned_to_user_id)?.name ?? '',
          assigned_to_user_profile_image_url:
            userMap.get(task.assigned_to_user_id)?.profileImageUrl ?? '',
        }),
        tracking_id: tracking?.id ?? null,
        status: tracking?.status ?? 'pending',
        comments: Array.isArray(tracking?.comments)
          ? tracking.comments.map((comment: any) => ({
              ...comment,
              username: userMap.get(comment.user_id)?.name ?? '',
              userprofileimage: userMap.get(comment.user_id)?.profileImageUrl ?? '',
            }))
          : [],
        updated_by_user_id: tracking?.updated_by_user_id ?? null,
        updated_by_user_name: tracking?.updated_by_user_id
          ? (userMap.get(tracking.updated_by_user_id)?.name ?? '')
          : null,
        tracking_updated_at: tracking?.updated_at ?? null,
      };
    });

    return FormatResponse(200, {
      message: 'Daily task review fetched successfully',
      date,
      tasks: dailyReview,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`{api: '/task-daily-tracking', error: ${JSON.stringify(error.errors)}}`);

      return FormatResponse(400, {
        message: 'Failed to fetch daily task review',
        error: error.errors,
      });
    }

    console.error(`{api: '/task-daily-tracking', error: ${error}}`);

    return FormatResponse(500, {
      message: 'Failed to fetch daily task review',
      error: error as Error,
    });
  }
};
