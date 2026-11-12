import { z, ZodError } from "zod";
import { FormatResponse } from "../../utils/response-formatter";
import { DeleteNotificationDeviceSchema } from "../../models/Notifications/notification.model";
import { NotificationDevicesDAL } from "../../dal/notification-devices.dal";

const notificationDevicesDAL = new NotificationDevicesDAL();

export const deleteNotificationDeviceHandler = async (
  pathParams: { userId?: string; deviceId?: string } | null | undefined,
  requestPayload?: z.infer<typeof DeleteNotificationDeviceSchema>
) => {
  try {
    const payload = DeleteNotificationDeviceSchema.parse(
      requestPayload ?? {
        userId: pathParams?.userId,
        deviceId: pathParams?.deviceId,
      }
    );

    console.info("Deleting notification device:", payload);

    await notificationDevicesDAL.deleteDevice(payload.userId, payload.deviceId);

    console.info("Device deleted successfully:", payload);

    return FormatResponse(200, {
      message: "Device deleted successfully",
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return FormatResponse(400, {
        message: "Request payload validation failed",
        error: error.errors,
      });
    }

    console.error("Failed to delete notification device:", error);
    return FormatResponse(500, {
      message: "Failed to delete notification device",
    });
  }
};
