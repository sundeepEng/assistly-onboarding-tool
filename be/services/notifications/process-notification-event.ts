import {
  NotificationDeviceRecord,
  NotificationDevicesDAL,
} from '../../dal/notification-devices.dal';
import { NotificationEventsDAL } from '../../dal/notification-events.dal';
import { NotificationEvent } from '../../models/Notifications/notification.model';
import { sendPushNotifications } from './push-provider';

/**
 * Worker that delivers a notification event to each recipient's active devices.
 * Fetches devices, dedupes tokens, calls the push provider, and updates the
 * event's per-recipient delivery status to `sent` or `failed`.
 */
const notificationDevicesDAL = new NotificationDevicesDAL();
const notificationEventsDAL = new NotificationEventsDAL();

const dedupeDevices = (devices: NotificationDeviceRecord[]) => {
  const seenTokens = new Set<string>();
  return devices.filter((device) => {
    if (!device.deviceToken) {
      return false;
    }

    if (seenTokens.has(device.deviceToken)) {
      return false;
    }

    seenTokens.add(device.deviceToken);
    return true;
  });
};

export const processNotificationEvent = async (
  payload: NotificationEvent,
  source: 'web' | 'cron'
) => {
  const { event_id, type } = payload;

  if (type !== source) {
    console.warn(
      `[notifications-${source}] Event ${event_id} type=${type} does not match source=${source}; skipping`
    );
    return;
  }

  const event = await notificationEventsDAL.getEventById(event_id);
  if (!event) {
    console.warn(`[notifications-${source}] Event not found: ${event_id}`);
    return;
  }

  if (!['queued', 'picked'].includes(event.status)) {
    console.info(`[notifications-${source}] Event ${event_id} already ${event.status}; skipping`);
    return;
  }

  const rawPayload =
    typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload || {};
  const recipients: { user_id: string }[] =
    typeof event.recipients === 'string' ? JSON.parse(event.recipients) : event.recipients || [];
  const trigger: Record<string, any> =
    typeof event.trigger === 'string' ? JSON.parse(event.trigger) : event.trigger || {};

  const { title, body, data } = rawPayload;

  if (!title || !body) {
    console.error(`[notifications-${source}] Event ${event_id} missing title or body`);
    await notificationEventsDAL
      .markFailed(event_id, trigger.userId, 'Missing title or body in payload')
      .catch((error) =>
        console.error(`[notifications-${source}] Failed to mark event failed`, error)
      );
    return;
  }

  for (const recipient of recipients) {
    const userId = recipient.user_id;
    if (!userId) {
      continue;
    }

    const devices = dedupeDevices(await notificationDevicesDAL.getDevicesByUserId(userId));

    if (!devices.length) {
      console.info(
        `[notifications-${source}] No active devices for user=${userId} event=${event_id}`
      );
      await notificationEventsDAL
        .markFailed(event_id, userId, 'No active devices for user')
        .catch((error) =>
          console.error(`[notifications-${source}] Failed to mark user failed`, error)
        );
      continue;
    }

    const results = await sendPushNotifications(devices, {
      notificationType: trigger.service_name ?? rawPayload.notificationType ?? 'notification',
      title,
      body,
      data,
    });

    const anySent = results.some((result) => result.status === 'sent');

    if (anySent) {
      await notificationEventsDAL
        .markSent(event_id, userId, results)
        .catch((error) => console.error(`[notifications-${source}] Failed to mark sent`, error));
    } else {
      const errorMessage = results
        .map((result) => result.error)
        .filter(Boolean)
        .join('; ');
      await notificationEventsDAL
        .markFailed(event_id, userId, errorMessage || 'All push attempts failed', results)
        .catch((error) => console.error(`[notifications-${source}] Failed to mark failed`, error));
    }
  }
};
