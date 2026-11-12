import { UserShiftsDAL } from '../../dal/user-shifts.dal';
import { FormatResponse } from '../../utils/response-formatter';
import { getPostgresConnection } from '../../utils/postgres-client';
import { reevaluateAndPersistOverlaps } from './shift-overlap-utils';
import { notifyUser } from '../notifications/notify-user';
import { getHomeTimezone } from './get-home-timezone';
import { getShiftDeletedNotification } from './shift-notification-utils';

const userShiftsDAL: UserShiftsDAL = new UserShiftsDAL();
export const deleteShiftHandler = async (shiftId: string | undefined) => {
  if (!shiftId) {
    console.error(`{method: DELETE, api: 'hcm/shift/{id}', error: No shiftId provided}`);

    return FormatResponse(400, {
      message: 'Failed to delete shift',
      error: 'No shiftId provided',
    });
  }

  try {
    const shiftIdNumber = Number(shiftId);

    const postgresDB = await getPostgresConnection();
    const deletedShift = await postgresDB.transaction(async (trx) => {
      const deleted = await userShiftsDAL.deleteShift(shiftIdNumber, trx);

      if (!deleted || deleted.length === 0) {
        throw new Error(`SHIFT_NOT_FOUND: Shift with id: ${shiftId} not found`);
      }

      const existingShift = deleted[0];
      const shiftDate = new Date(existingShift.shift_start_time).toISOString().split('T')[0];
      await reevaluateAndPersistOverlaps(
        existingShift.user_id,
        shiftDate,
        { excludeShiftId: shiftIdNumber },
        trx
      );

      return deleted;
    });

    // Notify only the user whose shift was deleted.
    const removedShift = deletedShift[0];
    const timeZone = await getHomeTimezone(removedShift.home_id);
    const { notificationType, title, body } = getShiftDeletedNotification(removedShift, timeZone);
    await notifyUser({
      notificationType,
      userId: removedShift.user_id,
      title,
      body,
      homeId: removedShift.home_id,
      entityId: String(removedShift.id),
      trigger: {
        service_name: 'delete-shift',
        action: 'deleted',
        old_data: removedShift,
      },
      data: {
        screen: 'ShiftList',
      },
    }).catch((error) =>
      console.error(
        `[notifications] Failed to notify user=${removedShift.user_id} for ${notificationType}`,
        error
      )
    );

    return FormatResponse(200, {
      message: 'Deleted shift successfully',
      data: deletedShift,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('SHIFT_NOT_FOUND')) {
      return FormatResponse(404, {
        message: 'Failed to delete shift',
        error: error.message.replace('SHIFT_NOT_FOUND: ', ''),
      });
    }
    console.error(`{method: DELETE, api: '/hcm/shift/{id}', error: ${error}}`);
    return FormatResponse(500, {
      message: 'Failed to delete shift',
      error: error,
    });
  }
};
