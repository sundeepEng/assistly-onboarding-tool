import { SQSEvent } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { NotificationEventSchema } from '../models/Notifications/notification.model';
import { NotificationEventsDAL } from '../dal/notification-events.dal';

const sqsClient = new SQSClient({
  region: process.env.CURRENT_AWS_REGION!,
});

const notificationEventsDAL = new NotificationEventsDAL();

export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    let eventId: string | undefined;
    try {
      const payload = NotificationEventSchema.parse(JSON.parse(record.body));
      eventId = payload.event_id;

      const dbEvent = await notificationEventsDAL.getEventById(eventId);
      if (!dbEvent) {
        console.warn(`[notifications-dispatcher] Event not found: ${eventId}`);
        continue;
      }

      if (dbEvent.status !== 'queued') {
        console.info(
          `[notifications-dispatcher] Event ${eventId} already ${dbEvent.status}; skipping`
        );
        continue;
      }

      await notificationEventsDAL.incrementAttempt(eventId);
      await notificationEventsDAL.markPicked(eventId);

      const queueUrl =
        payload.type === 'cron'
          ? process.env.NOTIFICATIONS_CRON_QUEUE_URL!
          : process.env.NOTIFICATIONS_WEB_QUEUE_URL!;

      if (!queueUrl) {
        console.error(
          `[notifications-dispatcher] No target queue configured for type=${payload.type}`
        );
        continue;
      }

      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(payload),
        })
      );

      console.info(
        `[notifications-dispatcher] Fanned out event=${eventId} to ${payload.type} queue`
      );
    } catch (error) {
      console.error('[notifications-dispatcher] Failed to dispatch event', {
        recordId: record.messageId,
        eventId,
        error,
      });
    }
  }
};
