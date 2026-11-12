import { z } from 'zod';
import { UserShiftsDAL } from '../../dal/user-shifts.dal';
import { UsersDAL } from '../../dal/users.dal';
import { FormatResponse } from '../../utils/response-formatter';
import { updateUserShiftSchema } from '../../models/HCM/user-shifts.model';

const userShiftsDAL: UserShiftsDAL = new UserShiftsDAL();
const usersDAL: UsersDAL = new UsersDAL();
export const getAllShiftsHandler = async (queryParams?: any) => {
  try {
    let allShifts: z.infer<typeof updateUserShiftSchema>[] =
      queryParams && Object.keys(queryParams).length > 0
        ? await userShiftsDAL.getAllShifts(queryParams)
        : await userShiftsDAL.getAllShifts();

    // Collect unique user IDs
    const uniqueUserIds = Array.from(
      new Set(
        allShifts.flatMap((shift) =>
          shift?.assigned_to_user_id
            ? [shift.user_id, shift.created_by_user_id, shift.assigned_to_user_id]
            : [shift.user_id, shift.created_by_user_id]
        )
      )
    );

    // Batch fetch users from DynamoDB
    const users = await usersDAL.batchFetchUsersByIds(uniqueUserIds);

    // Map userId → name
    const userMap = new Map<string, string>(users.map((u) => [u.userId, u.name]));

    // Enrich shifts with user names
    allShifts = allShifts.map((shift) => ({
      ...shift,
      user_name: userMap.get(shift.user_id) ?? '',
      created_by_user_name: userMap.get(shift.created_by_user_id) ?? '',
      ...(shift?.assigned_to_user_id && {
        assigned_to_user_name: userMap.get(shift.assigned_to_user_id) ?? '',
      }),
    }));

    return FormatResponse(200, {
      message: 'Fetched all shifts successfully',
      shifts: allShifts,
    });
  } catch (error) {
    console.error(`{api: '/get-all-shifts', error: ${error}}`);
    return FormatResponse(500, {
      message: 'Failed to fetch all shifts',
      error: error as Error,
    });
  }
};
