import { routeRequest } from './router';

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

export interface JobsDashboardApiHandlerOptions {
  /** Host policy; API Gateway must also apply its authorizer to every data route. */
  authorize: (event: APIGatewayProxyEventV2) => boolean | Promise<boolean>;
}

/**
 * Dashboard API Lambda handler. Call initJobs() before creating it:
 *
 *   initJobs({ tableName: Resource.JobTable.name });
 *   export const handler = createJobsDashboardApiHandler({ authorize: ... });
 */
export function createJobsDashboardApiHandler(options: JobsDashboardApiHandlerOptions) {
  if (typeof options.authorize !== 'function') {
    throw new Error('Jobs dashboard API requires an authorization policy');
  }
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    const body = event.body;

    // The unprotected OPTIONS route exists solely for the browser's preflight;
    // API Gateway supplies the configured exact-origin CORS response headers.
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        body: '',
      };
    }

    try {
      if (!(await options.authorize(event))) {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Forbidden' }),
        };
      }

      if (method === 'GET' && path === '/api/session') {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ authenticated: true }),
        };
      }

      const result = await routeRequest(method, path, body, event.queryStringParameters ?? {});

      return {
        statusCode: result.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.body),
      };
    } catch (error) {
      // A policy lookup outage fails closed. Never log token-bearing events.
      console.error('[jobs-api]', error instanceof Error ? error.name : typeof error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  };
}
