import { FormatResponse } from '../../utils/response-formatter';
import { NotificationEventsDAL } from '../../dal/notification-events.dal';

const notificationEventsDAL = new NotificationEventsDAL();

export const getNotificationEventsHandler = async (queryParams: Record<string, any> = {}) => {
  try {
    const events = await notificationEventsDAL.getEvents({
      status: queryParams.status,
      type: queryParams.type,
      homeId: queryParams.home_id,
      entityId: queryParams.entity_id,
      userId: queryParams.user_id,
      limit: queryParams.limit ? parseInt(queryParams.limit, 10) : 100,
    });

    return FormatResponse(200, {
      message: 'Notification events fetched successfully',
      data: events,
      count: events.length,
    });
  } catch (error) {
    console.error('[notification-events] Failed to fetch events:', error);
    return FormatResponse(500, {
      message: 'Failed to fetch notification events',
      error: (error as Error).message,
    });
  }
};
