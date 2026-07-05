import { routeRequest } from './router';

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Dashboard API Lambda handler. Call initJobs() before creating it:
 *
 *   initJobs({ tableName: Resource.JobTable.name });
 *   export const handler = createJobsDashboardApiHandler();
 */
export function createJobsDashboardApiHandler() {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    const body = event.body;

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: '',
      };
    }

    try {
      const result = await routeRequest(method, path, body, event.queryStringParameters ?? {});

      return {
        statusCode: result.statusCode,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify(result.body),
      };
    } catch (error) {
      // Log the full error for debugging but don't leak internals to the client

      console.error('[jobs-api]', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  };
}
