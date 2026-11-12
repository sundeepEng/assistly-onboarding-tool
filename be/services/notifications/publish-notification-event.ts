import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';
import { NotificationEventsDAL } from '../../dal/notification-events.dal';
import {
  NotificationEvent,
  NotificationEventSchema,
} from '../../models/Notifications/notification.model';

/**
 * Persists a notification request to the `notification_events` table and then
 * publishes it to the notifications SQS queue so the dispatcher can fan it out
 * to the appropriate web or cron worker. Retries the SQS send up to 3 times;
 * if all retries fail, the event remains `queued` and the reconcile job will
 * attempt to republish it later.
 */
const notificationEventsDAL = new NotificationEventsDAL();

const sqsClient = new SQSClient({
  region: process.env.CURRENT_AWS_REGION!,
});

interface PublishNotificationEventInput {
  type: 'web' | 'cron';
  homeId?: string;
  entityId?: string;
  correlationId?: string;
  trigger: {
    service_name: string;
    action: string;
    old_data?: Record<string, any>;
    new_data: Record<string, any>;
    userId: string;
  };
  recipients: { user_id: string }[];
  payload: Record<string, any>;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const publishNotificationEvent = async (
  input: PublishNotificationEventInput
): Promise<string> => {
  const correlationId = input.correlationId ?? randomUUID();

  const event = await notificationEventsDAL.createEvent({
    type: input.type,
    homeId: input.homeId,
    entityId: input.entityId,
    correlationId,
    trigger: input.trigger,
    recipients: input.recipients,
    payload: input.payload,
  });

  const queueMessage: NotificationEvent = NotificationEventSchema.parse({
    event_id: event.id,
    type: event.type,
    correlation_id: event.correlation_id,
    created_at: new Date(event.created_at).toISOString(),
    home_id: event.home_id,
    entity_id: event.entity_id,
    attempt: 0,
    trigger: input.trigger,
  });

  const queueUrl =
    process.env.NOTIFICATIONS_PRODUCER_QUEUE_URL! || process.env.NOTIFICATIONS_QUEUE_URL!;

  if (!queueUrl) {
    console.error('[notifications-publisher] No producer queue URL configured');
    return event.id;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(queueMessage),
        })
      );

      console.info(`[notifications-publisher] Published event=${event.id} to producer queue`);

      return event.id;
    } catch (error) {
      lastError = error;
      console.warn(
        `[notifications-publisher] SQS publish attempt ${attempt + 1} failed for event=${event.id}`,
        error
      );
      await delay(100 * Math.pow(2, attempt));
    }
  }

  console.error(
    `[notifications-publisher] SQS publish failed after 3 attempts for event=${event.id}. The reconcile job will retry.`,
    lastError
  );

  return event.id;
};
