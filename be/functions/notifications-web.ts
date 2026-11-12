import { SQSEvent } from 'aws-lambda';
import { NotificationEventSchema } from '../models/Notifications/notification.model';
import { processNotificationEvent } from '../services/notifications/process-notification-event';

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    try {
      const payload = NotificationEventSchema.parse(JSON.parse(record.body));
      await processNotificationEvent(payload, 'web');
    } catch (error) {
      console.error('[notifications-web] Failed to process event', {
        recordId: record.messageId,
        error,
      });
    }
  }
};
