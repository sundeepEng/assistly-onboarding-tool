import { ScheduledEvent } from 'aws-lambda';
import { runNotificationsReconcile } from '../services/notifications/reconcile';

export const handler = async (event: ScheduledEvent): Promise<void> => {
  console.info(
    '[notifications-reconcile] Invocation received',
    JSON.stringify({ time: event?.time ?? new Date().toISOString() })
  );

  await runNotificationsReconcile();
};
