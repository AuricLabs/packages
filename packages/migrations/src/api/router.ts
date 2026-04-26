import { executeMigrate, executeRollback, getStatus } from './routes/actions';
import { getExecutions, getExecutionById } from './routes/executions';
import { getMigrations, getMigrationsSummary, getMigrationById } from './routes/migrations';

import type { MigrationStorage } from '../types';

export interface RouteResult {
  statusCode: number;
  body: unknown;
}

export async function routeRequest(
  method: string,
  path: string,
  body: string | undefined,
  storage: MigrationStorage,
  migrationFunctionName?: string,
): Promise<RouteResult> {
  // Normalize path — strip trailing slash
  const normalizedPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;

  // GET /api/migrations/summary
  if (method === 'GET' && normalizedPath === '/api/migrations/summary') {
    const summary = await getMigrationsSummary(storage);
    return { statusCode: 200, body: summary };
  }

  // GET /api/migrations/:id
  const migrationIdMatch = /^\/api\/migrations\/(.+)$/.exec(normalizedPath);
  if (method === 'GET' && migrationIdMatch) {
    const id = decodeURIComponent(migrationIdMatch[1]);
    const records = await getMigrationById(storage, id);
    return { statusCode: 200, body: records };
  }

  // GET /api/migrations
  if (method === 'GET' && normalizedPath === '/api/migrations') {
    const migrations = await getMigrations(storage);
    return { statusCode: 200, body: migrations };
  }

  // GET /api/executions/:id
  const executionIdMatch = /^\/api\/executions\/(.+)$/.exec(normalizedPath);
  if (method === 'GET' && executionIdMatch) {
    const executionId = decodeURIComponent(executionIdMatch[1]);
    const records = await getExecutionById(storage, executionId);
    return { statusCode: 200, body: records };
  }

  // GET /api/executions
  if (method === 'GET' && normalizedPath === '/api/executions') {
    const executions = await getExecutions(storage);
    return { statusCode: 200, body: executions };
  }

  // GET /api/status
  if (method === 'GET' && normalizedPath === '/api/status') {
    const status = await getStatus(migrationFunctionName);
    return { statusCode: 200, body: status };
  }

  // POST /api/migrate
  if (method === 'POST' && normalizedPath === '/api/migrate') {
    let parsed: { target?: string } = {};
    if (body) {
      try {
        parsed = JSON.parse(body) as { target?: string };
      } catch {
        return { statusCode: 400, body: { error: 'Invalid JSON' } };
      }
    }
    const result = await executeMigrate(migrationFunctionName, parsed);
    return { statusCode: result.invoked ? 200 : 400, body: result };
  }

  // POST /api/rollback
  if (method === 'POST' && normalizedPath === '/api/rollback') {
    let parsed: { target?: string } = {};
    if (body) {
      try {
        parsed = JSON.parse(body) as { target?: string };
      } catch {
        return { statusCode: 400, body: { error: 'Invalid JSON' } };
      }
    }
    const result = await executeRollback(migrationFunctionName, parsed);
    return { statusCode: result.invoked ? 200 : 400, body: result };
  }

  return { statusCode: 404, body: { error: 'Not found' } };
}
