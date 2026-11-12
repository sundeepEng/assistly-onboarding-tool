import { UserShiftsDAL } from "../../dal/user-shifts.dal";
import { UsersDAL } from "../../dal/users.dal";
import { FormatResponse } from "../../utils/response-formatter";

const userShiftsDAL: UserShiftsDAL = new UserShiftsDAL();
const usersDAL: UsersDAL = new UsersDAL();
export const getShiftsForUserHandler = async (userId: string | undefined) => {
  if (!userId) {
    console.error(`{api: '/hcm/shifts/user/{id}', error: No userId provided}`);

    return FormatResponse(400, {
      message: "Failed to fetch shifts",
      error: "No userId provided",
    });
  }

  //Check if the user with Id exists in the users table
  if (Object.keys(await usersDAL.fetchUserById(userId))?.length == 0) {
    console.error(
      `{api: '/create-shift', error: User not found with ID: ${userId}}`
    );

    return FormatResponse(400, {
      message: "Failed to create shift",
      error: `User with userID - ${userId}  not found`,
    });
  }
  try {
    const allShifts = await userShiftsDAL.geShiftsByUserID(userId);
    return FormatResponse(200, {
      message: "Fetched all shifts successfully",
      data: allShifts,
    });
  } catch (error) {
    console.error(`{api: '/get-all-shifts', error: ${error}}`);
    return FormatResponse(500, {
      message: "Failed to fetch shifts for user",
      error: error,
    });
  }
};
