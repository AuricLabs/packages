import { isNonProd } from '@auriclabs/env';
import { logger } from '@auriclabs/logger';
import { MiddlewareObj } from '@middy/core';
import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { HttpError, isHttpError } from 'http-errors-enhanced';
import { StatusCodes } from 'http-status-codes';

import { ApiResponse, createErrorApiResponse, createSuccessApiResponse } from '../lib';

export const formattedResponse = (): MiddlewareObj<
  APIGatewayProxyEventV2,
  ApiResponse,
  Error | HttpError
> => {
  return {
    name: 'FormattedResponseMiddleware',
    after: (request) => {
      request.response = createSuccessApiResponse({
        data: request.response,
        statusCode: StatusCodes.OK,
        requestId: request.event.requestContext.requestId,
      });
    },
    onError: (request) => {
      if (isHttpError(request.error)) {
        request.response = createErrorApiResponse({
          // eslint-disable-next-line @typescript-eslint/no-misused-spread
          ...request.error,
          message: request.error.message,
          statusCode: request.error.statusCode,
          additionalHeaders: request.error.additionalHeaders, // eslint-disable-line @typescript-eslint/no-unsafe-assignment
          stack: request.error.stack,
          requestId: request.event.requestContext.requestId,
        });
      } else {
        logger.error(request.error, 'Unhandled error');
        request.response = createErrorApiResponse({
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          message: (isNonProd() && request.error?.message) || 'Internal Server Error',
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          stack: isNonProd() ? request.error?.stack : undefined,
          type: request.error?.name,
          requestId: request.event.requestContext.requestId,
        });
      }
    },
  };
};
