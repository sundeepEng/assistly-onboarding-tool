import { APIGatewayEvent, APIGatewayProxyResult, SQSEvent } from 'aws-lambda';
import { unprotectedRoutes, Routes, Methods } from '../utils/constants';
import { FormatResponse } from '../utils/response-formatter';

import { handlers } from '../services/route-handlers';
import { normalizeQueryParams } from '../utils/query-params';
import {
  NotificationQueueMessage,
  NotificationQueueMessageSchema,
} from '../models/Notifications/notification.model';
import { NotificationDeviceRecord, NotificationDevicesDAL } from '../dal/notification-devices.dal';
import { sendPushNotifications } from '../services/notifications/push-provider';
import { NotificationEventsDAL } from '../dal/notification-events.dal';

const notificationDevicesDAL = new NotificationDevicesDAL();
const notificationEventsDAL = new NotificationEventsDAL();

const isSQSEvent = (event: any): event is SQSEvent => {
  return Boolean(event?.Records) && Array.isArray(event.Records);
};

export const handler = async (
  event: APIGatewayEvent | SQSEvent
): Promise<APIGatewayProxyResult | void> => {
  if (isSQSEvent(event)) {
    await processNotificationQueue(event);
    return;
  }

  return handleApiGatewayEvent(event);
};

const handleApiGatewayEvent = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  const {
    httpMethod,
    resource,
    body,
    headers,
    queryStringParameters,
    multiValueQueryStringParameters,
    pathParameters,
  } = event;

  console.info('Request Headers:', JSON.stringify(headers, null, 2));
  console.info('Request Body:', JSON.stringify(body, null, 2));
  console.info(
    'Query Params:',
    JSON.stringify(normalizeQueryParams(queryStringParameters, multiValueQueryStringParameters))
  );

  const requestPayload = body ? JSON.parse(body) : {};
  const token = headers.Authorization || headers.authorization;

  if (!unprotectedRoutes.includes(resource) && !token) {
    return FormatResponse(401, {
      message: 'Unauthorized',
      error: 'Authorization token is missing',
    });
  }

  switch (true) {
    case resource === Routes.initiateESignRoute && httpMethod === Methods.httpMethodPost:
      return handlers.initiateESignHandler(requestPayload);

    case resource === Routes.eSignWebhookRoute && httpMethod === Methods.httpMethodPost:
      return handlers.ESignWebhookHandler(requestPayload);

    case resource === Routes.embeddedSignRoute && httpMethod === Methods.httpMethodPost:
      return handlers.EmbeddedSignatureHandler(requestPayload);

    case resource === Routes.docusealBuilderTokenRoute && httpMethod === Methods.httpMethodPost:
      return handlers.generateDocusealBuilderTokenHandler(requestPayload);

    case resource === Routes.docusealCreateSubmissionRoute && httpMethod === Methods.httpMethodPost:
      return handlers.createDocusealSubmissionHandler(requestPayload);

    case resource === Routes.sqsJobStatusRoute && httpMethod === Methods.httpMethodGet:
      return handlers.sqsJobsHandler(pathParameters?.id);

    case resource === Routes.webVitalsRoute && httpMethod === Methods.httpMethodPost:
      return handlers.webVitalsHandler(requestPayload);

    case resource === Routes.registerNotificationDeviceRoute &&
      httpMethod === Methods.httpMethodPost:
      return handlers.registerNotificationDeviceHandler(requestPayload);

    case resource === Routes.deleteNotificationDeviceRoute &&
      httpMethod === Methods.httpMethodDelete:
      return handlers.deleteNotificationDeviceHandler(pathParameters, requestPayload);

    case resource === Routes.enqueueNotificationRoute && httpMethod === Methods.httpMethodPost:
      return handlers.enqueueNotificationHandler(requestPayload);

    case resource === Routes.getNotificationEventsRoute && httpMethod === Methods.httpMethodGet:
      return handlers.getNotificationEventsHandler(
        normalizeQueryParams(queryStringParameters, multiValueQueryStringParameters)
      );

    case resource === Routes.supportRoute && httpMethod === Methods.httpMethodPost:
      return handlers.createSupportTicketHandler(requestPayload);

    case resource === Routes.stripeCreateAccountRoute && httpMethod === Methods.httpMethodPost:
      return handlers.createStripeAccountHandler(requestPayload);

    case resource === Routes.stripeWebhookRoute && httpMethod === Methods.httpMethodPost:
      return handlers.stripeWebhookHandler(event);

    case resource === Routes.stripeOnboardingLinkRoute && httpMethod === Methods.httpMethodPost:
      return handlers.createStripeOnboardingLinkHandler(requestPayload);

    default:
      return FormatResponse(404, {
        message: 'Endpoint not found',
        error: 'Endpoint does not exist',
      });
  }
};

const processNotificationQueue = async (event: SQSEvent) => {
  for (const record of event.Records) {
    let eventId: string | undefined;
    let payload: NotificationQueueMessage | undefined;

    try {
      payload = NotificationQueueMessageSchema.parse(JSON.parse(record.body));
      eventId = payload.eventId;

      if (eventId) {
        await notificationEventsDAL
          .markPicked(eventId)
          .catch((error) =>
            console.error(`[notifications] Failed to mark event=${eventId} as picked`, error)
          );
      }

      const devices = dedupeDevices(
        await notificationDevicesDAL.getDevicesByUserId(payload.userId)
      );

      if (!devices.length) {
        console.info(
          `[notifications] No devices found for notificationType=${payload.notificationType}`
        );

        if (eventId) {
          await notificationEventsDAL
            .markFailed(eventId, payload.userId, 'No registered devices for userId')
            .catch((error) =>
              console.error(`[notifications] Failed to mark event=${eventId} as failed`, error)
            );
        }

        continue;
      }

      const results = await sendPushNotifications(devices, {
        notificationType: payload.notificationType,
        title: payload.data.title,
        body: payload.data.body,
        data: {
          userId: payload.data.userId,
          deepLink: payload.data.deepLink,
          screen: payload.data.screen,
          documentName: payload.data.documentName,
          documentExpiryDate: payload.data.documentExpiryDate,
        },
      });

      if (eventId) {
        const anySent = results.some((result) => result.status === 'sent');

        if (anySent) {
          await notificationEventsDAL
            .markSent(eventId, payload.userId, results)
            .catch((error) =>
              console.error(`[notifications] Failed to mark event=${eventId} as sent`, error)
            );
        } else {
          const errorMessage = results
            .map((result) => result.error)
            .filter(Boolean)
            .join('; ');
          await notificationEventsDAL
            .markFailed(
              eventId,
              payload.userId,
              errorMessage || 'All push attempts failed',
              results
            )
            .catch((error) =>
              console.error(`[notifications] Failed to mark event=${eventId} as failed`, error)
            );
        }
      }
    } catch (error) {
      console.error('[notifications] Failed to process notification queue message', {
        recordId: record.messageId,
        error,
      });

      if (eventId && payload) {
        await notificationEventsDAL
          .markFailed(eventId, payload.userId, (error as Error).message)
          .catch((dalError) =>
            console.error(`[notifications] Failed to mark event=${eventId} as failed`, dalError)
          );
      }
    }
  }
};

const dedupeDevices = (devices: NotificationDeviceRecord[]) => {
  const seenTokens = new Set<string>();
  return devices.filter((device) => {
    if (!device.deviceToken) {
      return false;
    }

    if (seenTokens.has(device.deviceToken)) {
      return false;
    }

    seenTokens.add(device.deviceToken);
    return true;
  });
};
