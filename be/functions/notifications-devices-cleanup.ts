import { ScheduledEvent } from 'aws-lambda';
import { runNotificationDevicesCleanup } from '../services/notifications/cleanup-devices';

export const handler = async (event: ScheduledEvent): Promise<void> => {
  console.info(
    '[notifications-devices-cleanup] Invocation received',
    JSON.stringify({ time: event?.time ?? new Date().toISOString() })
  );

  await runNotificationDevicesCleanup();
};
