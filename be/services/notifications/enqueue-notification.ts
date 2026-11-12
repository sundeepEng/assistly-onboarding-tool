import { z, ZodError } from 'zod';
import { NotificationJobSchema } from '../../models/Notifications/notification.model';
import { FormatResponse } from '../../utils/response-formatter';
import { publishNotificationEvent } from './publish-notification-event';

/**
 * HTTP handler that validates a notification job, normalizes the recipients,
 * and publishes it as a `web` notification event for the dispatcher to deliver.
 */
export const enqueueNotificationHandler = async (
  requestPayload: z.infer<typeof NotificationJobSchema>
) => {
  try {
    const validatedPayload = NotificationJobSchema.parse(requestPayload);

    const recipientUserIds = [
      ...(validatedPayload.userIds ?? []),
      ...(validatedPayload.userId ? [validatedPayload.userId] : []),
    ];

    const firstUserId = recipientUserIds[0] ?? 'system';

    const eventId = await publishNotificationEvent({
      type: 'web',
      trigger: {
        service_name: validatedPayload.notificationType,
        action: 'send',
        new_data: validatedPayload.data ?? {},
        userId: firstUserId,
      },
      recipients: recipientUserIds.map((userId) => ({ user_id: userId })),
      payload: {
        notificationType: validatedPayload.notificationType,
        title: validatedPayload.title,
        body: validatedPayload.body,
        data: validatedPayload.data,
      },
    });

    return FormatResponse(202, {
      message: 'Notification enqueued successfully',
      recipients: recipientUserIds.length,
      eventId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return FormatResponse(400, {
        message: 'Invalid request payload',
        error: error.errors,
      });
    }

    console.error('Failed to enqueue notification:', error);
    return FormatResponse(500, {
      message: 'Failed to enqueue notification',
    });
  }
};
