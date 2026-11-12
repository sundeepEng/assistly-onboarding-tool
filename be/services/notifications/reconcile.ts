import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { NotificationEventsDAL } from '../../dal/notification-events.dal';
import { NotificationEventSchema } from '../../models/Notifications/notification.model';

const notificationEventsDAL = new NotificationEventsDAL();
const sqsClient = new SQSClient({
  region: process.env.CURRENT_AWS_REGION!,
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Re-publishes notification events that were created in the DB but never reached
// the dispatcher queue (e.g. SQS publish failed). Only looks at status='queued'.
// Events in 'picked' state are not retried here, so a stuck picked event will
// remain stuck unless the worker completes or fails it.
export const runNotificationsReconcile = async () => {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const events = await notificationEventsDAL.getEvents({
    status: 'queued',
    createdAtBefore: cutoff,
    limit: 100,
  });

  console.info(
    '[notifications-reconcile] Found queued events to republish',
    JSON.stringify({ count: events.length, cutoff })
  );

  const queueUrl =
    process.env.NOTIFICATIONS_PRODUCER_QUEUE_URL! || process.env.NOTIFICATIONS_QUEUE_URL!;

  if (!queueUrl) {
    console.error('[notifications-reconcile] No producer queue URL configured');
    return;
  }

  for (const event of events) {
    const queueMessage = NotificationEventSchema.safeParse({
      event_id: event.id,
      type: event.type,
      correlation_id: event.correlation_id,
      created_at: new Date(event.created_at).toISOString(),
      home_id: event.home_id,
      entity_id: event.entity_id,
      attempt: event.attempt ?? 0,
      trigger: typeof event.trigger === 'string' ? JSON.parse(event.trigger) : event.trigger,
    });

    if (!queueMessage.success) {
      console.error(
        `[notifications-reconcile] Failed to parse event ${event.id}; marking failed`,
        queueMessage.error
      );
      await notificationEventsDAL
        .markFailed(event.id, 'system', 'Invalid event shape for reconcile')
        .catch((error) =>
          console.error('[notifications-reconcile] Failed to mark event failed', error)
        );
      continue;
    }

    try {
      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify(queueMessage.data),
        })
      );

      console.info(`[notifications-reconcile] Republished event ${event.id}`);

      await delay(100);
    } catch (error) {
      console.error(`[notifications-reconcile] Failed to republish event ${event.id}`, error);
    }
  }
};
