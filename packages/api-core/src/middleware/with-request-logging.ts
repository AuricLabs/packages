import { logger, Logger } from '@auriclabs/logger';
import { MiddlewareObj } from '@middy/core';
import {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  Context,
} from 'aws-lambda';
import { lambdaRequestTracker } from 'pino-lambda';

const withRequest = lambdaRequestTracker({
  requestMixin(event) {
    return {
      userId: (event as APIGatewayProxyEventV2WithJWTAuthorizer).requestContext.authorizer?.jwt // eslint-disable-line @typescript-eslint/no-unnecessary-condition
        ?.claims?.sub, // eslint-disable-line @typescript-eslint/no-unnecessary-condition
      path: event.rawPath,
      method: (event as APIGatewayProxyEventV2).requestContext.http.method,
    };
  },
});

export interface ContextWithLogger extends Context {
  logger: Logger;
}

export const withRequestLogging = (): MiddlewareObj<
  APIGatewayProxyEventV2,
  unknown,
  unknown,
  ContextWithLogger
> => {
  return {
    name: 'LoggerMiddleware',
    before: (request) => {
      const { event, context } = request;
      withRequest(event, context);
      Object.assign(context, logger);
    },
  };
};
