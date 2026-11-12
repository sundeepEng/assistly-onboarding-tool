import { z, ZodError } from 'zod';
import { FormatResponse } from '../../utils/response-formatter';
import { RegisterNotificationDeviceSchema } from '../../models/Notifications/notification.model';
import {
  NotificationDeviceRecord,
  NotificationDevicesDAL,
} from '../../dal/notification-devices.dal';

const notificationDevicesDAL = new NotificationDevicesDAL();

export const registerNotificationDeviceHandler = async (
  requestPayload: z.infer<typeof RegisterNotificationDeviceSchema>
) => {
  try {
    const validatedPayload = RegisterNotificationDeviceSchema.parse(requestPayload);

    console.info('Validated payload:', validatedPayload);

    const existingRecord = await notificationDevicesDAL.getDevice(
      validatedPayload.userId,
      validatedPayload.deviceId
    );

    console.info('Existing record:', existingRecord);

    // Ensure device token is unique per user
    await notificationDevicesDAL.deleteDevicesByToken(validatedPayload.deviceToken);

    console.info('Deleted existing devices with ID:', validatedPayload.deviceId);

    await notificationDevicesDAL.upsertDevice({
      userId: validatedPayload.userId,
      deviceId: validatedPayload.deviceId,
      deviceToken: validatedPayload.deviceToken,
      platform: validatedPayload.platform,
      appVersion: validatedPayload.appVersion,
      metadata: validatedPayload.metadata,
      createdAt: existingRecord?.createdAt,
    });

    console.info('Device registered successfully:', validatedPayload);

    return FormatResponse(201, {
      message: 'Device registered successfully',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('Request payload validation failed:', error.errors);

      return FormatResponse(400, {
        message: 'Request payload validation failed',
        error: error.errors,
      });
    }

    console.error('Failed to register notification device:', error);
    return FormatResponse(500, {
      message: 'Failed to register notification device',
      error: error,
    });
  }
};
