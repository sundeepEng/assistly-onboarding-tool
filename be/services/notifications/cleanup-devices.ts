import { NotificationDevicesDAL } from '../../dal/notification-devices.dal';

const notificationDevicesDAL = new NotificationDevicesDAL();

export const runNotificationDevicesCleanup = async () => {
  console.info('[notification-cleanup] Starting stale device cleanup');

  const deletedCount = await notificationDevicesDAL.deleteStaleDevices();

  console.info(
    '[notification-cleanup] Stale device cleanup completed',
    JSON.stringify({ deletedCount })
  );
};
