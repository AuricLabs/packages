import middy from '@middy/core';
import httpCors from '@middy/http-cors';
import httpEventNormalizer from '@middy/http-event-normalizer';

import { jsonBodyParser, withRequestLogging, formattedResponse } from './middleware';

import type { APIGatewayProxyEventV2 } from 'aws-lambda';

export const apiFn = middy<APIGatewayProxyEventV2>()
  // separate this type out as we want the type for context to apply
  .use(withRequestLogging())
  .use([
    httpEventNormalizer(),
    // TODO add cors specific for certain endpoints
    httpCors({
      origin: '*',
      methods: '*',
      headers: '*',
    }),
    jsonBodyParser(),
    formattedResponse(),
  ]);
