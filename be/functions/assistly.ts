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
    path,
  } = event;
  console.info('Request Headers:', JSON.stringify(headers, null, 2));
  console.info('Request Body:', JSON.stringify(body, null, 2));

  const requestPayload = body ? JSON.parse(body) : {};
  const token = headers.Authorization || headers.authorization;

  if (!unprotectedRoutes.includes(resource) && !token) {
    return FormatResponse(401, {
      message: 'Unauthorized',
      error: 'Authorization token is missing',
    });
  }

  switch (true) {
    case resource === Routes.signUpRoute && httpMethod === Methods.httpMethodPost:
      return handlers.signUpHandler(requestPayload);

    case resource === Routes.pchoSignUpRoute && httpMethod === Methods.httpMethodPost:
      return handlers.pchoSignUpHandler(requestPayload);

    case resource === Routes.homeAdminSignUpRoute && httpMethod === Methods.httpMethodPost:
      return handlers.homeAdminSignUpHandler(requestPayload);

    case resource === Routes.accountActivationRoute && httpMethod === Methods.httpMethodPost:
      return handlers.accountActivationHandler(requestPayload);

    case resource === Routes.signInRoute && httpMethod === Methods.httpMethodPost:
      return handlers.signInHandler(requestPayload);

    case resource === Routes.resetPasswordRoute && httpMethod === Methods.httpMethodPut:
      return handlers.resetPasswordHandler(requestPayload);

    case resource === Routes.confirmResetPasswordRoute && httpMethod === Methods.httpMethodPut:
      return handlers.confirmResetPasswordHandler(requestPayload);

    case resource === Routes.refreshTokenRoute && httpMethod === Methods.httpMethodPost:
      return handlers.refreshTokenHandler(requestPayload);

    case resource === Routes.createUserRoute && httpMethod === Methods.httpMethodPost:
      return handlers.createUserHandler(requestPayload);

    case resource === Routes.homeTourRoute && httpMethod === Methods.httpMethodPost:
      return handlers.homeTourHandler(requestPayload);

    case resource === Routes.getAllUsersRoute && httpMethod === Methods.httpMethodGet:
      return handlers.getAllUsersHandler(
        normalizeQueryParams(queryStringParameters, multiValueQueryStringParameters)
      );

    case resource === Routes.getUserByIdRoute && httpMethod === Methods.httpMethodGet:
      return handlers.getUserByIdHandler(pathParameters?.id);

    case resource === Routes.updateUserRoute && httpMethod === Methods.httpMethodPut:
      return handlers.updateUserHandler(pathParameters?.id, requestPayload);

    case resource === Routes.deleteUserRoute && httpMethod === Methods.httpMethodDelete:
      return handlers.deleteUserHandler(pathParameters?.id);

    case resource === Routes.updateClinicalRoute && httpMethod === Methods.httpMethodPut:
      return handlers.updateClinicalHandler(pathParameters?.id, requestPayload);

    case resource === Routes.updatePasswordRoute && httpMethod === Methods.httpMethodPut:
      return handlers.updatePasswordHandler(requestPayload);

    case resource === Routes.s3PreSignedURLRoute && httpMethod == Methods.httpMethodGet:
      return handlers.s3PresignedUrlHandler(queryStringParameters);

    case resource === Routes.rbacRoute && httpMethod === Methods.httpMethodGet:
      return handlers.getRBACRoleHandler(queryStringParameters);

    case resource === Routes.rbacRoute && httpMethod === Methods.httpMethodPut:
      return handlers.upsertRBACRoleHandler(requestPayload);

    case resource === Routes.upsertHomeRoute && httpMethod === Methods.httpMethodPut:
      return handlers.upsertHomeHandler(requestPayload);

    case resource === Routes.getHomeByIdRoute && httpMethod === Methods.httpMethodGet:
      return handlers.getHomeByIdHandler(pathParameters?.id);

    case resource === Routes.campaignRoute && httpMethod === Methods.httpMethodPut:
      return handlers.upsertCampaignHandler(requestPayload);

    case resource === Routes.salesMetricsRoute && httpMethod === Methods.httpMethodGet:
      const salesMetricsQueryParams = normalizeQueryParams(
        queryStringParameters,
        multiValueQueryStringParameters
      );
      return handlers.getSalesMetricsHandler(salesMetricsQueryParams as any);

    default:
      return FormatResponse(404, {
        message: 'Endpoint not found',
        error: 'Endpoint does not exist',
      });
  }
};
