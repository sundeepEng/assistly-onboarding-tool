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
    case resource === Routes.createInvoiceRoute && httpMethod === Methods.httpMethodPost:
      return handlers.createInvoiceHandler(requestPayload);

    case resource === Routes.createInvoiceRoute && httpMethod === Methods.httpMethodGet:
      const invoiceQueryParams = normalizeQueryParams(
        queryStringParameters,
        multiValueQueryStringParameters
      );
      return handlers.getAllInvoicesHandler(invoiceQueryParams);

    case resource === Routes.updateInvoiceRoute && httpMethod === Methods.httpMethodPut:
      return handlers.updateInvoiceHandler(pathParameters?.id, requestPayload);

    case resource === Routes.paymentRoute && httpMethod === Methods.httpMethodPost:
      return handlers.createPaymentHandler(requestPayload);

    case resource === Routes.paymentRoute && httpMethod === Methods.httpMethodGet:
      const paymentQueryParams = normalizeQueryParams(
        queryStringParameters,
        multiValueQueryStringParameters
      );
      return handlers.getAllPaymentsHandler(paymentQueryParams);

    case resource === Routes.updatePaymentRoute && httpMethod === Methods.httpMethodPut:
      return handlers.updatePaymentHandler(pathParameters?.id, requestPayload);

    case resource === Routes.payoutRoute && httpMethod === Methods.httpMethodPost:
      return handlers.createPayoutHandler(requestPayload);

    case resource === Routes.payoutRoute && httpMethod === Methods.httpMethodGet:
      const payoutQueryParams = normalizeQueryParams(
        queryStringParameters,
        multiValueQueryStringParameters
      );
      return handlers.getAllPayoutsHandler(payoutQueryParams);

    case resource === Routes.updatePayoutRoute && httpMethod === Methods.httpMethodPut:
      return handlers.updatePayoutHandler(pathParameters?.id, requestPayload);

    case resource === Routes.updatePayoutRoute && httpMethod === Methods.httpMethodDelete:
      return handlers.deletePayoutHandler(pathParameters?.id);

    case resource === Routes.budgetRoute && httpMethod === Methods.httpMethodPost:
      return handlers.createBudgetHandler(requestPayload);

    case resource === Routes.budgetRoute && httpMethod === Methods.httpMethodGet:
      const budgetQueryParams = normalizeQueryParams(
        queryStringParameters,
        multiValueQueryStringParameters
      );
      return handlers.getAllBudgetsHandler(budgetQueryParams);

    case resource === Routes.updateBudgetRoute && httpMethod === Methods.httpMethodPut:
      return handlers.updateBudgetHandler(pathParameters?.id, requestPayload);

    case resource === Routes.budgetDashboardMetricsRoute && httpMethod === Methods.httpMethodGet:
      const budgetDashboardQueryParams = normalizeQueryParams(
        queryStringParameters,
        multiValueQueryStringParameters
      );
      return handlers.getBudgetDashboardMetricsHandler(budgetDashboardQueryParams as any);

    default:
      return FormatResponse(404, {
        message: 'Endpoint not found',
        error: 'Endpoint does not exist',
      });
  }
};
