import { describe, it, expect, vi } from 'vitest';

import { routeRequest } from './router';

import type { MigrationRecord, MigrationStorage } from '../types';

vi.mock('./routes/actions', () => ({
  executeMigrate: vi.fn().mockResolvedValue({ message: 'Migration initiated', invoked: true }),
  executeRollback: vi.fn().mockResolvedValue({ message: 'Rollback initiated', invoked: true }),
  getStatus: vi.fn().mockResolvedValue({ pending: ['mig-1'], completed: [], failed: [] }),
}));

function makeRecord(overrides: Partial<MigrationRecord> = {}): MigrationRecord {
  return {
    id: 'mig-1',
    name: 'test',
    status: 'completed',
    direction: 'up',
    startedAt: 1000,
    executionId: 'exec-1',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function createMockStorage(records: MigrationRecord[] = []): MigrationStorage {
  return {
    getRecord: vi.fn(),
    getAllRecords: vi.fn().mockResolvedValue(records),
    getRecordsByStatus: vi.fn().mockResolvedValue([]),
    getRecordsByExecutionId: vi.fn().mockResolvedValue([]),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
  };
}

describe('routeRequest', () => {
  it('GET /api/migrations returns 200 with migrations', async () => {
    const records = [makeRecord({ id: 'mig-1' })];
    const storage = createMockStorage(records);

    const result = await routeRequest('GET', '/api/migrations', undefined, storage);

    expect(result.statusCode).toBe(200);
    expect(result.body).toHaveLength(1);
  });

  it('GET /api/migrations/summary returns 200 with summary', async () => {
    const records = [makeRecord({ id: 'mig-1', status: 'completed' })];
    const storage = createMockStorage(records);

    const result = await routeRequest('GET', '/api/migrations/summary', undefined, storage);

    expect(result.statusCode).toBe(200);
    expect(result.body).toHaveProperty('completed');
    expect(result.body).toHaveProperty('pending');
    expect(result.body).toHaveProperty('failed');
    expect(result.body).toHaveProperty('total');
  });

  it('GET /api/migrations/:id returns 200 with records for that id', async () => {
    const records = [
      makeRecord({ id: 'mig-1', createdAt: 100 }),
      makeRecord({ id: 'mig-2', createdAt: 200 }),
    ];
    const storage = createMockStorage(records);

    const result = await routeRequest('GET', '/api/migrations/mig-1', undefined, storage);

    expect(result.statusCode).toBe(200);
    const body = result.body as MigrationRecord[];
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((r) => r.id === 'mig-1')).toBe(true);
  });

  it('GET /api/migrations/:id handles URL-encoded ids', async () => {
    const records = [makeRecord({ id: 'mig-1/special' })];
    const storage = createMockStorage(records);

    const result = await routeRequest('GET', '/api/migrations/mig-1%2Fspecial', undefined, storage);

    expect(result.statusCode).toBe(200);
  });

  it('GET /api/executions returns 200', async () => {
    const storage = createMockStorage([]);

    const result = await routeRequest('GET', '/api/executions', undefined, storage);

    expect(result.statusCode).toBe(200);
  });

  it('GET /api/executions/:id returns 200', async () => {
    const storage = createMockStorage([]);

    const result = await routeRequest('GET', '/api/executions/exec-1', undefined, storage);

    expect(result.statusCode).toBe(200);
  });

  it('GET /api/status returns 200 with status when function name provided', async () => {
    const storage = createMockStorage([]);

    const result = await routeRequest('GET', '/api/status', undefined, storage, 'my-fn');

    expect(result.statusCode).toBe(200);
    expect(result.body).toHaveProperty('pending');
  });

  it('GET /api/status returns 200 with empty result when no function name', async () => {
    const storage = createMockStorage([]);

    const result = await routeRequest('GET', '/api/status', undefined, storage);

    expect(result.statusCode).toBe(200);
  });

  it('POST /api/migrate returns 200 when function name is provided', async () => {
    const storage = createMockStorage([]);

    const result = await routeRequest('POST', '/api/migrate', '{}', storage, 'my-fn');

    expect(result.statusCode).toBe(200);
    expect(result.body).toHaveProperty('invoked', true);
  });

  it('POST /api/migrate returns 400 when no function name', async () => {
    // Need to re-mock for this test to return invoked: false
    const { executeMigrate } = await import('./routes/actions');
    vi.mocked(executeMigrate).mockResolvedValueOnce({
      message: 'Migrate is not available.',
      invoked: false,
    });

    const storage = createMockStorage([]);

    const result = await routeRequest('POST', '/api/migrate', '{}', storage);

    expect(result.statusCode).toBe(400);
    expect(result.body).toHaveProperty('invoked', false);
  });

  it('POST /api/rollback returns 200 when function name is provided', async () => {
    const storage = createMockStorage([]);

    const result = await routeRequest('POST', '/api/rollback', '{}', storage, 'my-fn');

    expect(result.statusCode).toBe(200);
    expect(result.body).toHaveProperty('invoked', true);
  });

  it('POST /api/rollback returns 400 when no function name', async () => {
    const { executeRollback } = await import('./routes/actions');
    vi.mocked(executeRollback).mockResolvedValueOnce({
      message: 'Rollback is not available.',
      invoked: false,
    });

    const storage = createMockStorage([]);

    const result = await routeRequest('POST', '/api/rollback', '{}', storage);

    expect(result.statusCode).toBe(400);
    expect(result.body).toHaveProperty('invoked', false);
  });

  it('POST /api/migrate with malformed JSON returns 400', async () => {
    const storage = createMockStorage([]);

    const result = await routeRequest('POST', '/api/migrate', '{invalid json', storage, 'my-fn');

    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual({ error: 'Invalid JSON' });
  });

  it('POST /api/rollback with malformed JSON returns 400', async () => {
    const storage = createMockStorage([]);

    const result = await routeRequest('POST', '/api/rollback', 'not-json', storage, 'my-fn');

    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual({ error: 'Invalid JSON' });
  });

  it('POST /api/migrate parses target from body', async () => {
    const { executeMigrate } = await import('./routes/actions');
    vi.mocked(executeMigrate).mockResolvedValueOnce({
      message: 'Migration initiated',
      invoked: true,
    });

    const storage = createMockStorage([]);

    const result = await routeRequest(
      'POST',
      '/api/migrate',
      JSON.stringify({ target: 'mig-1' }),
      storage,
      'my-fn',
    );

    expect(result.statusCode).toBe(200);
    expect(executeMigrate).toHaveBeenCalledWith('my-fn', { target: 'mig-1' });
  });

  it('strips trailing slash', async () => {
    const storage = createMockStorage([]);

    const result = await routeRequest('GET', '/api/migrations/', undefined, storage);

    expect(result.statusCode).toBe(200);
  });

  it('returns 404 for unknown routes', async () => {
    const storage = createMockStorage([]);

    const result = await routeRequest('GET', '/api/unknown', undefined, storage);

    expect(result.statusCode).toBe(404);
    expect(result.body).toEqual({ error: 'Not found' });
  });

  it('returns 404 for wrong HTTP method', async () => {
    const storage = createMockStorage([]);

    const result = await routeRequest('POST', '/api/migrations', undefined, storage);

    expect(result.statusCode).toBe(404);
  });
});
