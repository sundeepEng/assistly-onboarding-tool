import { UserShiftsDAL } from '../../dal/user-shifts.dal';
import { z } from 'zod';
import { FormatResponse } from '../../utils/response-formatter';
import { updateUserShiftSchema } from '../../models/HCM/user-shifts.model';
import { UsersDAL } from '../../dal/users.dal';
import { getPostgresConnection } from '../../utils/postgres-client';
import { reevaluateAndPersistOverlaps } from './shift-overlap-utils';
import { notifyUser } from '../notifications/notify-user';
import { getHomeTimezone } from './get-home-timezone';
import {
  getShiftUpdatedNotification,
  getUnavailabilityApprovalNotification,
} from './shift-notification-utils';

const userShiftsDAL: UserShiftsDAL = new UserShiftsDAL();
const usersDAL: UsersDAL = new UsersDAL();
export const updateShiftHandler = async (
  shiftId: any,
  updatedShiftData: z.infer<typeof updateUserShiftSchema>
) => {
  if (!shiftId || !updatedShiftData) {
    console.error(`{api: '/update-shift', error: No body provided}`);

    return FormatResponse(400, {
      message: 'Failed to update shift',
      error: 'No body provided',
    });
  }

  //Check if the shift ID in path params matches with the shift id in the body
  if (updatedShiftData.id != (shiftId as number)) {
    return FormatResponse(400, {
      message: 'Failed to update shift',
      error: 'Shift ID mismatch - Shift ID in the body does not match with the path parameter',
    });
  }

  //Check if the user with Id exists in the users table
  const userDetails = await usersDAL.fetchUserById(updatedShiftData?.user_id);

  if (Object.keys(userDetails)?.length === 0) {
    console.error(
      `{api: '/update-shift', error: User not found with ID: ${updatedShiftData?.user_id}}`
    );

    return FormatResponse(400, {
      message: 'Failed to update shift',
      error: `User with userID - ${updatedShiftData?.user_id}  not found`,
    });
  }

  // If the user is soft deleted, return error
  if (userDetails.isDeleted === true) {
    return FormatResponse(403, {
      message: 'Failed to update shift',
      error: `Cannot update shift for the user with userId - ${updatedShiftData.user_id} as the record is soft deleted`,
    });
  }

  //Check if the shift start time is greater than the shift end time
  if (updatedShiftData.shift_start_time >= updatedShiftData.shift_end_time) {
    return FormatResponse(400, {
      message: 'Failed to update shift',
      error: 'Shift start time cannot be greater than or equal to shift end time',
    });
  }

  //Check the shift overlap only if the shift timings are updated
  //Get shift by shift id
  const [existingShift] = await userShiftsDAL.getAllShifts({
    id: updatedShiftData.id,
  });

  if (Object.keys(existingShift)?.length === 0) {
    return FormatResponse(404, {
      message: 'Failed to update shift',
      error: `Shift with id: ${updatedShiftData.id} not found`,
    });
  }

  console.info(`Existing shift details:`, JSON.stringify(existingShift));

  const isStartTimeChanged =
    new Date(updatedShiftData.shift_start_time).getTime() !==
    new Date(existingShift.shift_start_time).getTime();

  const isEndTimeChanged =
    new Date(updatedShiftData.shift_end_time).getTime() !==
    new Date(existingShift.shift_end_time).getTime();

  const isShiftStatusChange = updatedShiftData.shift_status !== existingShift.shift_status;

  const isUnavailabilityApprovalChanged =
    updatedShiftData.is_unavailability_approved !== existingShift.is_unavailability_approved;

  const isUserIdChanged = updatedShiftData.user_id !== existingShift.user_id;

  console.info(
    `Update Shift Service: Existing Shift: ${JSON.stringify(
      existingShift
    )}, Start Time Changed: ${isStartTimeChanged}, End Time Changed: ${isEndTimeChanged}, Shift Status Change: ${isShiftStatusChange}, Unavailability Approval Changed: ${isUnavailabilityApprovalChanged}, UserIDChanged: ${isUserIdChanged}`
  );

  // Re-evaluate overlaps when shift times, status, approval state, or user change
  const shouldReevaluateOverlaps =
    isStartTimeChanged ||
    isEndTimeChanged ||
    isUserIdChanged ||
    isShiftStatusChange ||
    isUnavailabilityApprovalChanged;

  const oldUserId = existingShift.user_id;
  const newUserId = updatedShiftData.user_id;
  const oldShiftDate = new Date(existingShift.shift_start_time).toISOString().split('T')[0];
  const newShiftDate = new Date(updatedShiftData.shift_start_time).toISOString().split('T')[0];
  const userChanged = oldUserId !== newUserId;
  const dateChanged = oldShiftDate !== newShiftDate;

  const updatedShiftWithNewValues = {
    ...existingShift,
    ...updatedShiftData,
    id: existingShift.id,
  };

  try {
    const validatedData = updateUserShiftSchema.parse(updatedShiftData);
    console.info(
      `{api: '/update-shift', message: 'Validated data', data: ${JSON.stringify(validatedData)}}`
    );

    const modifiedShiftData = {
      ...updatedShiftData,
      updated_at: new Date().toISOString(),
    };

    const postgresDB = await getPostgresConnection();
    await postgresDB.transaction(async (trx) => {
      if (shouldReevaluateOverlaps) {
        // Re-evaluate overlaps for the new user/date (the updated shift belongs here)
        const reevaluatedNewShifts = await reevaluateAndPersistOverlaps(
          newUserId,
          newShiftDate,
          {
            excludeShiftId: existingShift.id,
            includeShift: updatedShiftWithNewValues,
          },
          trx
        );

        // Determine the updated shift's new isOverlap value so it can be persisted below
        const updatedShiftResult = reevaluatedNewShifts.find(
          (shift) => shift.id === updatedShiftData.id
        );
        if (updatedShiftResult) {
          modifiedShiftData.isOverlap = updatedShiftResult.isOverlap ?? false;
        }

        // If the shift moved to a different user or date, re-evaluate overlaps for the old user/date
        // so the remaining shifts there are correctly updated (e.g., B becomes non-overlap after A is reassigned)
        if (userChanged || dateChanged) {
          await reevaluateAndPersistOverlaps(
            oldUserId,
            oldShiftDate,
            {
              excludeShiftId: existingShift.id,
            },
            trx
          );
        }
      }

      await userShiftsDAL.updateShift(modifiedShiftData?.id, modifiedShiftData, trx);
    });

    // Only notify for meaningful changes: times, status, approval state, or reassignment.
    // Fire-and-forget so a notification failure never fails the API response.
    const shouldNotifyUser =
      isStartTimeChanged ||
      isEndTimeChanged ||
      isShiftStatusChange ||
      isUnavailabilityApprovalChanged ||
      userChanged;

    if (shouldNotifyUser) {
      const timeZone = await getHomeTimezone(updatedShiftData.home_id);
      const notificationPayload = isUnavailabilityApprovalChanged
        ? getUnavailabilityApprovalNotification(
            updatedShiftData,
            updatedShiftData.is_unavailability_approved === true,
            timeZone
          )
        : getShiftUpdatedNotification(updatedShiftData, timeZone);

      await notifyUser({
        notificationType: notificationPayload.notificationType,
        userId: newUserId,
        title: notificationPayload.title,
        body: notificationPayload.body,
        homeId: updatedShiftData.home_id,
        entityId: String(existingShift.id),
        trigger: {
          service_name: 'update-shift',
          action: 'updated',
          old_data: existingShift,
          new_data: updatedShiftData,
          userId: updatedShiftData.user_id,
        },
        data: {
          screen: 'ShiftDetails',
          deepLink: `shifts/${existingShift.id}`,
        },
      }).catch((error) =>
        console.error(
          `[notifications] Failed to notify user=${newUserId} for ${notificationPayload.notificationType}`,
          error
        )
      );
    }

    // If the shift was reassigned, let the previous owner know as well.
    if (userChanged && oldUserId) {
      await notifyUser({
        notificationType: 'SHIFT_REMOVED',
        userId: oldUserId,
        title: 'Shift removed',
        body: 'A previously assigned shift has been reassigned to another user.',
        homeId: existingShift.home_id,
        entityId: String(existingShift.id),
        trigger: {
          service_name: 'update-shift',
          action: 'reassigned',
          old_data: existingShift,
          new_data: updatedShiftData,
          userId: updatedShiftData.user_id,
        },
        data: {
          screen: 'ShiftList',
        },
      }).catch((error) =>
        console.error(
          `[notifications] Failed to notify old user=${oldUserId} for SHIFT_REMOVED`,
          error
        )
      );
    }

    return FormatResponse(200, {
      message: 'Shift updated successfully',
    });
  } catch (error) {
    console.error(`{api: '/update-shift', error: ${error}}`);

    if (error instanceof z.ZodError) {
      console.error('Validation error: ', error.errors);
      return FormatResponse(400, {
        message: 'Failed to update shift',
        error: error.errors,
      });
    }
    return FormatResponse(500, {
      message: 'Failed to update shift',
      error: error,
    });
  }
};
