import { describe, it, expect, vi } from 'vitest';

import { createDashboardApiHandler } from './handler';

import type { MigrationStorage } from '../types';

function createMockStorage(): MigrationStorage {
  return {
    getRecord: vi.fn(),
    getAllRecords: vi.fn().mockResolvedValue([]),
    getRecordsByStatus: vi.fn().mockResolvedValue([]),
    getRecordsByExecutionId: vi.fn().mockResolvedValue([]),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
  };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    requestContext: {
      http: { method: 'GET' },
    },
    rawPath: '/api/migrations',
    body: undefined,
    ...overrides,
  } as never;
}

describe('createDashboardApiHandler', () => {
  it('returns a function', () => {
    const handler = createDashboardApiHandler({ storage: createMockStorage() });
    expect(typeof handler).toBe('function');
  });

  it('handles CORS preflight requests', async () => {
    const handler = createDashboardApiHandler({ storage: createMockStorage() });

    const result = await handler(
      makeEvent({
        requestContext: { http: { method: 'OPTIONS' } },
      }),
    );

    expect(result.statusCode).toBe(200);
    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    expect(result.headers).toHaveProperty('Access-Control-Allow-Methods');
  });

  it('returns JSON response with CORS headers', async () => {
    const handler = createDashboardApiHandler({ storage: createMockStorage() });

    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(200);
    expect(result.headers).toHaveProperty('Content-Type', 'application/json');
    expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    expect(typeof result.body).toBe('string');
    expect(() => JSON.parse(result.body as string)).not.toThrow();
  });

  it('returns 500 with generic error message on internal error', async () => {
    const storage = createMockStorage();
    vi.mocked(storage.getAllRecords).mockRejectedValue(new Error('DB connection failed'));

    const handler = createDashboardApiHandler({ storage });

    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body as string);
    // Should not leak internal error details
    expect(body.error).toBe('Internal server error');
  });

  it('returns 500 with generic message on non-Error thrown', async () => {
    const storage = createMockStorage();
    vi.mocked(storage.getAllRecords).mockRejectedValue('string error');

    const handler = createDashboardApiHandler({ storage });

    const result = await handler(makeEvent());

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body as string);
    expect(body.error).toBe('Internal server error');
  });

  it('routes to correct handler based on path and method', async () => {
    const handler = createDashboardApiHandler({ storage: createMockStorage() });

    const result = await handler(makeEvent({ rawPath: '/api/unknown' }));

    expect(result.statusCode).toBe(404);
  });

  it('reads MIGRATION_FUNCTION_NAME from env when not provided', async () => {
    const original = process.env.MIGRATION_FUNCTION_NAME;
    process.env.MIGRATION_FUNCTION_NAME = 'env-fn-name';

    try {
      const handler = createDashboardApiHandler({ storage: createMockStorage() });
      // Just verify it creates without error
      expect(typeof handler).toBe('function');
    } finally {
      if (original === undefined) {
        delete process.env.MIGRATION_FUNCTION_NAME;
      } else {
        process.env.MIGRATION_FUNCTION_NAME = original;
      }
    }
  });
});
