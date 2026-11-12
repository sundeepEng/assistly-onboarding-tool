import { z } from 'zod';

export const RegisterNotificationDeviceSchema = z
  .object({
    userId: z.string().uuid({ message: 'userId is required' }),
    deviceId: z.string().uuid({ message: 'deviceId is required' }),
    deviceToken: z.string().min(1, 'deviceToken is required'),
    platform: z.enum(['ios', 'android']),
    appVersion: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict();

export const DeleteNotificationDeviceSchema = z
  .object({
    userId: z.string().uuid({ message: 'userId is required' }),
    deviceId: z.string().uuid({ message: 'deviceId is required' }),
  })
  .strict();

export const NotificationJobSchema = z
  .object({
    notificationType: z.string().min(1, 'notificationType is required'),
    title: z.string().min(1, 'title is required'),
    body: z.string().min(1, 'body is required'),
    userId: z.string().optional(),
    userIds: z.array(z.string().min(1)).optional(),
    data: z.record(z.any()).optional(),
  })
  .strict()
  .refine(
    (payload) =>
      Boolean(payload.userId) || (Array.isArray(payload.userIds) && payload.userIds.length > 0),
    {
      message: 'Provide at least one recipient via userId or userIds',
      path: ['userId'],
    }
  );

export const NotificationQueueMessageSchema = z
  .object({
    notificationType: z.string().min(1),
    userId: z.string().uuid({ message: 'userId is required' }),
    eventId: z.string().uuid().optional(),
    data: z
      .object({
        title: z.string().min(1, 'title is required'),
        body: z.string().min(1, 'body is required'),
        userId: z.string().uuid({ message: 'userId is required' }),
        deepLink: z.string().optional(),
        screen: z.string().optional(),
        documentName: z.string().optional(),
        documentExpiryDate: z.string().optional(),
        homeName: z.string().optional(),
      })
      .strict(),
  })
  .strict();

export type NotificationQueueMessage = z.infer<typeof NotificationQueueMessageSchema>;

export const NotificationEventTriggerSchema = z
  .object({
    service_name: z.string().min(1),
    action: z.string().min(1),
    old_data: z.record(z.any()).optional(),
    new_data: z.record(z.any()),
    userId: z.string().uuid(),
  })
  .strict();

export const NotificationEventSchema = z
  .object({
    event_id: z.string().uuid(),
    type: z.enum(['web', 'cron']),
    correlation_id: z.string().uuid(),
    created_at: z.string().datetime(),
    home_id: z.string().uuid().optional(),
    entity_id: z.string().optional(),
    attempt: z.number().int().min(0).default(0),
    trigger: NotificationEventTriggerSchema,
  })
  .strict();

export type NotificationEvent = z.infer<typeof NotificationEventSchema>;
