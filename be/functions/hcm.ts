import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda';
import { unprotectedRoutes, Routes, Methods } from '../utils/constants';
import { FormatResponse } from '../utils/response-formatter';

import { handlers } from '../services/route-handlers';
import { normalizeQueryParams } from '../utils/query-params';

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
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
  console.info('Request Resource: ', resource);
  console.info('Query String Parameters: ', queryStringParameters);
  console.info('Multi Value Query String Parameters: ', multiValueQueryStringParameters);

  const requestPayload = body ? JSON.parse(body) : {};
  const token = headers.Authorization || headers.authorization;

  if (!unprotectedRoutes.includes(resource) && !token) {
    return FormatResponse(401, {
      message: 'Unauthorized',
      error: 'Authorization token is missing',
    });
  }

  switch (true) {
    case resource === Routes.getAllShiftsRoute && httpMethod === Methods.httpMethodGet:
      const shiftsQueryParams = normalizeQueryParams(
        queryStringParameters,
        multiValueQueryStringParameters
      );
      return handlers.getAllShiftsHandler(shiftsQueryParams);

    case resource === Routes.createShiftRoute && httpMethod === Methods.httpMethodPost:
      return handlers.createShiftHandler(requestPayload);

    case resource === Routes.updateShiftRoute && httpMethod === Methods.httpMethodPut:
      return handlers.updateShiftHandler(pathParameters?.id, requestPayload);

    case resource === Routes.getShiftsByUserIdRoute && httpMethod === Methods.httpMethodGet:
      return handlers.getShiftsForUserHandler(pathParameters?.id);

    case resource === Routes.deleteShiftRoute && httpMethod === Methods.httpMethodDelete:
      return handlers.deleteShiftHandler(pathParameters?.id);

    case resource === Routes.getTeamRoasterRoute && httpMethod === Methods.httpMethodGet:
      const teamRoasterQueryParams = normalizeQueryParams(
        queryStringParameters,
        multiValueQueryStringParameters
      );
      return handlers.getTeamRoasterHandler(teamRoasterQueryParams);

    case resource === Routes.upsertTeamRoasterRoute && httpMethod === Methods.httpMethodPut:
      return handlers.upsertTeamRoasterHandler(requestPayload);

    case resource === Routes.createBroadcastRoute && httpMethod === Methods.httpMethodPost:
      return handlers.createBroadcastHandler(requestPayload);

    case resource === Routes.getAllBroadcastsRoute && httpMethod === Methods.httpMethodGet:
      const broadcastQueryParams = normalizeQueryParams(
        queryStringParameters,
        multiValueQueryStringParameters
      );
      return handlers.getAllBroadcastsHandler(broadcastQueryParams);

    case resource === Routes.upsertConversationRoute && httpMethod === Methods.httpMethodPut:
      return handlers.upsertConversationHandler(requestPayload);

    case resource === Routes.getUserConversationsRoute && httpMethod === Methods.httpMethodGet:
      return handlers.getUserConversationsHandler(queryStringParameters);

    case resource === Routes.upsertConversationMessagesRoute &&
      httpMethod === Methods.httpMethodPut:
      return handlers.upsertConversationMessagesHandler(requestPayload);

    case resource === Routes.getConversationMessagesRoute && httpMethod === Methods.httpMethodGet:
      return handlers.getConversationMessagesHandler(pathParameters?.id);

    case resource === Routes.generateCertificateRoute && httpMethod === Methods.httpMethodPost:
      return handlers.generateCertificateHandler(requestPayload);

    case resource === Routes.getAllTasksRoute && httpMethod === Methods.httpMethodGet:
      const taskQueryParams = normalizeQueryParams(
        queryStringParameters,
        multiValueQueryStringParameters
      );
      return handlers.getAllTasksHandler(taskQueryParams);

    case resource === Routes.createTaskRoute && httpMethod === Methods.httpMethodPost:
      return handlers.createTaskHandler(requestPayload);

    case resource === Routes.updateTaskRoute && httpMethod === Methods.httpMethodPut:
      return handlers.updateTaskHandler(pathParameters?.id, requestPayload);

    case resource === Routes.deleteTaskRoute && httpMethod === Methods.httpMethodDelete:
      return handlers.deleteTaskHandler(pathParameters?.id);

    case resource === Routes.taskDailyTrackingRoute && httpMethod === Methods.httpMethodGet:
      const trackingQueryParams = normalizeQueryParams(
        queryStringParameters,
        multiValueQueryStringParameters
      );
      return handlers.getDailyTaskTrackingHandler(trackingQueryParams);

    case resource === Routes.taskDailyTrackingRoute && httpMethod === Methods.httpMethodPut:
      return handlers.upsertTaskDailyTrackingHandler(requestPayload);

    default:
      return FormatResponse(404, {
        message: 'Endpoint not found',
        error: 'Endpoint does not exist',
      });
  }
};
