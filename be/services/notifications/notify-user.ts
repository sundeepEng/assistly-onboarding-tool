import { publishNotificationEvent } from './publish-notification-event';

export interface NotifyUserPayload {
  notificationType: string;
  userId: string | string[];
  title: string;
  body: string;
  data?: {
    deepLink?: string;
    screen?: string;
    documentName?: string;
    documentExpiryDate?: string;
    homeName?: string;
  };
  /** Home this notification belongs to. Required to record it in notification_events. */
  homeId: string;
  /** Related entity id (e.g. shift id, broadcast id, document id). */
  entityId?: string;
  /** Metadata describing what triggered this notification, stored in notification_events.trigger. */
  trigger?: Record<string, any>;
  /** 'web' for API-triggered notifications, 'cron' for scheduled jobs. Defaults to 'web'. */
  type?: 'web' | 'cron';
}

export const notifyUser = async (payload: NotifyUserPayload) => {
  const recipientUserIds = Array.from(
    new Set(Array.isArray(payload.userId) ? payload.userId : [payload.userId])
  ).filter(Boolean);

  const trigger = {
    service_name: payload.trigger?.service_name ?? payload.notificationType,
    action: payload.trigger?.action ?? 'send',
    old_data: payload.trigger?.old_data,
    new_data: payload.trigger?.new_data ?? payload.data,
    userId: payload.trigger?.userId ?? recipientUserIds[0] ?? 'system',
  };

  const eventId = await publishNotificationEvent({
    type: payload.type ?? 'web',
    homeId: payload.homeId,
    entityId: payload.entityId,
    trigger,
    recipients: recipientUserIds.map((userId) => ({ user_id: userId })),
    payload: {
      notificationType: payload.notificationType,
      title: payload.title,
      body: payload.body,
      data: payload.data,
    },
  });

  console.info(
    `[notifications] Published event=${eventId} type=${payload.notificationType} recipients=${recipientUserIds.length}`
  );

  return { eventId };
};
