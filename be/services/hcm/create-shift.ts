import { UserShiftsDAL } from '../../dal/user-shifts.dal';
import { FormatResponse } from '../../utils/response-formatter';
import { z } from 'zod';
import { createUserShiftSchema } from '../../models/HCM/user-shifts.model';
import { UsersDAL } from '../../dal/users.dal';
import { getPostgresConnection } from '../../utils/postgres-client';
import {
  isOccupiedShift,
  reevaluateAndPersistOverlaps,
  shiftsOverlap,
} from './shift-overlap-utils';
import { notifyUser } from '../notifications/notify-user';
import { getHomeTimezone } from './get-home-timezone';
import { getShiftCreatedNotification } from './shift-notification-utils';

const userShiftsDAL: UserShiftsDAL = new UserShiftsDAL();
const usersDAL: UsersDAL = new UsersDAL();
export const createShiftHandler = async (
  newShiftData: z.infer<typeof createUserShiftSchema> | z.infer<typeof createUserShiftSchema>[]
) => {
  if (!newShiftData || (Array.isArray(newShiftData) && newShiftData.length === 0)) {
    console.error(`{api: '/create-shift', error: No body provided}`);

    return FormatResponse(400, {
      message: 'Failed to create shift',
      error: 'No body provided',
    });
  }

  let shifts = Array.isArray(newShiftData) ? newShiftData : [newShiftData];

  //#region Validations
  // Sort shifts by start time for bulk creation logic
  shifts = shifts.sort(
    (a, b) => new Date(a.shift_start_time).getTime() - new Date(b.shift_start_time).getTime()
  );

  // Track processed occupied shifts for overlap checking within the same request
  const processedOccupiedShifts: typeof shifts = [];

  for (let i = 0; i < shifts.length; i++) {
    const shift = shifts[i];
    const { user_id, shift_start_time, shift_end_time } = shift;

    //Check if the user with Id exists in the users table
    const userDetails = await usersDAL.fetchUserById(user_id);

    if (Object.keys(userDetails)?.length === 0) {
      console.error(`{api: '/create-shift', error: User not found with ID: ${user_id}}`);

      return FormatResponse(400, {
        message: 'Failed to create shift',
        error: `User with userID - ${user_id} not found`,
      });
    }

    // If the user is soft deleted, return error
    if (userDetails.isDeleted === true) {
      return FormatResponse(404, {
        message: 'Failed to update shift',
        error: `Cannot create shift for the user with userId - ${user_id} as the record is soft deleted`,
      });
    }

    //Check if the shift start time is greater than the shift end time
    if (shift_start_time >= shift_end_time) {
      return FormatResponse(400, {
        message: 'Failed to create shift',
        error: 'Shift start time cannot be greater than or equal to shift end time',
      });
    }

    // Prevent duplicate timeoff/vacation requests for the same time
    if (shift.shift_status === 'timeoff' || shift.shift_status === 'vacation') {
      // Check against existing timeoff/vacation shifts in DB
      const hasTimeoffVacationOverlap = await userShiftsDAL.checkTimeoffVacationOverlap(
        user_id,
        shift_start_time,
        shift_end_time
      );

      if (hasTimeoffVacationOverlap) {
        return FormatResponse(409, {
          message: 'Failed to create shift',
          error: 'Timeoff or vacation shift already exists for this user at this time',
        });
      }

      // Check against other timeoff/vacation shifts in the same bulk request
      const hasInternalTimeoffVacationOverlap = shifts
        .slice(0, i)
        .some(
          (previousShift) =>
            previousShift.user_id === user_id &&
            (previousShift.shift_status === 'timeoff' ||
              previousShift.shift_status === 'vacation') &&
            shiftsOverlap(shift, previousShift)
        );

      if (hasInternalTimeoffVacationOverlap) {
        return FormatResponse(409, {
          message: 'Failed to create shift',
          error: 'Timeoff or vacation shift already exists for this user at this time',
        });
      }
    }

    // Determine if this is a bulk creation or single shift
    const isBulkCreation = shifts.length > 1;

    // Always check for overlaps with existing shifts in DB
    const overlapResult = await checkShiftOverLap(user_id, shift_start_time, shift_end_time);

    // Handle the case where checkShiftOverLap returns an error response
    if (typeof overlapResult !== 'boolean') {
      return overlapResult; // Return the error response
    }

    const hasDbOverlap = overlapResult;

    const shiftIsOccupied = isOccupiedShift(shift);

    let hasInternalOverlap = false;

    if (isBulkCreation && shiftIsOccupied) {
      // BULK CREATION: Also check for overlaps between occupied shifts in this request
      hasInternalOverlap = processedOccupiedShifts.some(
        (processedShift) =>
          processedShift.user_id === user_id && shiftsOverlap(shift, processedShift)
      );
    }

    const hasAnyOverlap = hasDbOverlap || hasInternalOverlap;

    console.info(
      `DEBUG - Shift ${i} (${shift_start_time} to ${shift_end_time}): isBulk=${isBulkCreation}, shiftIsOccupied=${shiftIsOccupied}, hasDbOverlap=${hasDbOverlap}, hasInternalOverlap=${hasInternalOverlap}`
    );

    // BULK: First occupied shift by time is always isOverlap: false, rest are isOverlap: true if they overlap with anything
    // SINGLE: isOverlap: true only if it overlaps with existing occupied DB shifts
    // Non-occupied shifts (rejected timeoff/vacation) are always isOverlap: false
    if (!shiftIsOccupied) {
      shift.isOverlap = false;
      console.info(
        `DEBUG - Shift is non-occupied (rejected timeoff/vacation), setting isOverlap=false`
      );
    } else if (isBulkCreation) {
      // Bulk creation logic
      if (processedOccupiedShifts.length === 0) {
        shift.isOverlap = false; // First occupied shift in bulk is always original
        console.info(`DEBUG - Bulk first occupied shift, setting isOverlap=false`);
      } else {
        shift.isOverlap = hasAnyOverlap; // Subsequent occupied shifts: overlap if overlapping with DB or previous occupied shifts
        console.info(`DEBUG - Bulk subsequent occupied shift, setting isOverlap=${hasAnyOverlap}`);
      }
    } else {
      // Single shift logic
      shift.isOverlap = hasDbOverlap;
      console.info(
        `DEBUG - Single occupied shift, setting isOverlap=${hasDbOverlap} based on DB overlap`
      );
    }

    // Add to processed occupied shifts for internal overlap checking
    if (shiftIsOccupied) {
      processedOccupiedShifts.push(shift);
    }

    try {
      const validatedData = createUserShiftSchema.parse(shift);
      console.info(
        `{api: '/create-shift', message: 'Validated data', data: ${JSON.stringify(validatedData)}}`
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Validation error: ', error.errors);
        return FormatResponse(400, {
          message: 'Request payload validation failed',
          error: error.errors,
        });
      }
    }
  }
  //#endregion

  let insertedShifts: any[] = [];

  try {
    const postgresDB = await getPostgresConnection();
    await postgresDB.transaction(async (trx) => {
      insertedShifts = await userShiftsDAL.createShift(shifts, trx);

      // Re-evaluate overlaps for all affected users and dates so existing shifts
      // are correctly updated when new approved timeoff/vacation or available shifts overlap them.
      const reevaluations = new Map<string, { userId: string; shiftDate: string }>();
      for (const shift of shifts) {
        const userId = shift.user_id;
        const shiftDate = new Date(shift.shift_start_time).toISOString().split('T')[0];
        reevaluations.set(`${userId}#${shiftDate}`, { userId, shiftDate });
      }

      for (const { userId, shiftDate } of reevaluations.values()) {
        await reevaluateAndPersistOverlaps(userId, shiftDate, undefined, trx);
      }
    });

    // Notify only the specific user(s) whose shift(s) were created.
    // Fire-and-forget: a notification failure should never fail the API response.
    await Promise.all(
      insertedShifts.map(async (shift) => {
        const timeZone = await getHomeTimezone(shift.home_id);
        const { notificationType, title, body } = getShiftCreatedNotification(shift, timeZone);
        return notifyUser({
          notificationType,
          userId: shift.user_id,
          title,
          body,
          homeId: shift.home_id,
          entityId: String(shift.id),
          trigger: {
            service_name: 'create-shift',
            action: 'created',
            new_data: shift,
            userId: shift.created_by_user_id,
          },
          data: {
            screen: 'ShiftDetails',
            deepLink: `shifts/${shift.id}`,
          },
        }).catch((error) =>
          console.error(
            `[notifications] Failed to notify user=${shift.user_id} for ${notificationType}`,
            error
          )
        );
      })
    );

    return FormatResponse(201, {
      message: 'Shift created successfully',
    });
  } catch (error) {
    console.error(`{api: '/create-shift', error: ${error}}`);

    return FormatResponse(500, {
      message: 'Failed to create shift',
      error: error,
    });
  }
};

export const checkShiftOverLap = async (
  userId: string,
  shiftStartTime: string,
  shiftEndTime: string,
  trx?: any
) => {
  if (!userId || !shiftStartTime || !shiftEndTime) {
    console.error(`{api: '/check-shift-overlap', error: No body provided}`);

    return FormatResponse(400, {
      message: 'Failed to check shift overlap',
      error: 'No body provided',
    });
  }

  try {
    const overlapExists = await userShiftsDAL.checkShiftOverLap(
      userId,
      shiftStartTime,
      shiftEndTime,
      undefined,
      trx
    );

    return overlapExists;
  } catch (error) {
    console.error(`{api: '/check-shift-overlap', error: ${error}}`);

    return FormatResponse(500, {
      message: 'Failed to check shift overlap',
      error: error,
    });
  }
};
