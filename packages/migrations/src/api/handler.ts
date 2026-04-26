import { routeRequest } from './router';

import type { MigrationStorage } from '../types';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

export interface DashboardApiOptions {
  storage: MigrationStorage;
  /** Override the migration function name. If omitted, reads MIGRATION_FUNCTION_NAME set by createDashboard(). */
  migrationFunctionName?: string;
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function createDashboardApiHandler(options: DashboardApiOptions) {
  const migrationFunctionName =
    options.migrationFunctionName ?? process.env.MIGRATION_FUNCTION_NAME;

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
      const result = await routeRequest(method, path, body, options.storage, migrationFunctionName);

      return {
        statusCode: result.statusCode,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify(result.body),
      };
    } catch (error) {
      // Log the full error for debugging but don't leak internals to the client

      console.error('[migrations-api]', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  };
}
