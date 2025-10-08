import { MiddlewareObj } from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import { APIGatewayProxyEventV2 } from 'aws-lambda';

const { before: parseJsonBody } = httpJsonBodyParser();

if (!parseJsonBody) {
  throw new Error('Error initializing json body parser');
}

export const JSON_BODY_METHODS = ['POST', 'PUT', 'PATCH'];

export const jsonBodyParser = (): MiddlewareObj<APIGatewayProxyEventV2> => {
  return {
    before: (request) => {
      if (JSON_BODY_METHODS.includes(request.event.requestContext.http.method.toUpperCase())) {
        if (request.event.body) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return parseJsonBody(request);
        } else {
          Object.assign(request.event, { body: {} });
        }
      }
    },
  };
};
