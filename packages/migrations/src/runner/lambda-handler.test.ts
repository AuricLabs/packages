import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createLambdaHandler } from './lambda-handler';

import type { MigrationStorage } from '../types';
import type { Context } from 'aws-lambda';

vi.mock('../utils/lambda', () => ({
  invokeLambdaAsync: vi.fn().mockResolvedValue(undefined),
}));

function createMockStorage(): MigrationStorage {
  return {
    getRecord: vi.fn().mockResolvedValue(null),
    getAllRecords: vi.fn().mockResolvedValue([]),
    getRecordsByStatus: vi.fn().mockResolvedValue([]),
    getRecordsByExecutionId: vi.fn().mockResolvedValue([]),
    createRecord: vi.fn().mockImplementation(async (record) => ({
      ...record,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })),
    updateRecord: vi.fn().mockImplementation(async (id, direction, _executionId, updates) => ({
      id,
      direction,
      ...updates,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })),
  };
}

function createMockContext(overrides?: Partial<Context>): Context {
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'test-migration-fn',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123:function:test',
    memoryLimitInMB: '128',
    awsRequestId: 'req-1',
    logGroupName: '/aws/lambda/test',
    logStreamName: 'stream-1',
    getRemainingTimeInMillis: () => 300_000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
    ...overrides,
  };
}

describe('createLambdaHandler', () => {
  let storage: MigrationStorage;

  beforeEach(() => {
    storage = createMockStorage();
    vi.clearAllMocks();
  });

  it('handles status action', async () => {
    const handler = createLambdaHandler({
      createConfig: () => ({
        migrations: [
          {
            id: '20250601_first',
            migration: { name: 'first', up: async () => {}, down: async () => {} },
          },
        ],
        storage,
        context: {},
      }),
    });

    const result = await handler({ action: 'status' }, createMockContext());

    expect(result).toHaveProperty('pending');
    expect(result).toHaveProperty('completed');
    expect(result).toHaveProperty('failed');
  });

  it('runs migrations up by default', async () => {
    const upFn = vi.fn().mockResolvedValue(undefined);
    const handler = createLambdaHandler({
      createConfig: () => ({
        migrations: [
          {
            id: '20250601_first',
            migration: { name: 'first', up: upFn, down: async () => {} },
          },
        ],
        storage,
        context: {},
      }),
    });

    const result = await handler({}, createMockContext());

    expect(upFn).toHaveBeenCalledOnce();
    expect(result).toHaveProperty('status', 'completed');
  });

  it('runs migrations down when direction is specified', async () => {
    vi.mocked(storage.getAllRecords).mockResolvedValue([
      {
        id: '20250601_first',
        name: 'first',
        status: 'completed',
        direction: 'up',
        startedAt: 1000,
        executionId: 'exec-1',
        createdAt: 1000,
        updatedAt: 1000,
      },
    ]);

    const downFn = vi.fn().mockResolvedValue(undefined);
    const handler = createLambdaHandler({
      createConfig: () => ({
        migrations: [
          {
            id: '20250601_first',
            migration: { name: 'first', up: async () => {}, down: downFn },
          },
        ],
        storage,
        context: {},
      }),
    });

    const result = await handler({ direction: 'down' }, createMockContext());

    expect(downFn).toHaveBeenCalledOnce();
    expect(result).toHaveProperty('status', 'completed');
  });

  it('passes target from event to runner', async () => {
    const upFn1 = vi.fn().mockResolvedValue(undefined);
    const upFn2 = vi.fn().mockResolvedValue(undefined);

    const handler = createLambdaHandler({
      createConfig: () => ({
        migrations: [
          {
            id: '20250601_first',
            migration: { name: 'first', up: upFn1, down: async () => {} },
          },
          {
            id: '20250602_second',
            migration: { name: 'second', up: upFn2, down: async () => {} },
          },
        ],
        storage,
        context: {},
      }),
    });

    await handler({ target: '20250601_first' }, createMockContext());

    expect(upFn1).toHaveBeenCalledOnce();
    expect(upFn2).not.toHaveBeenCalled();
  });

  it('re-invokes Lambda on needs_continuation', async () => {
    const { invokeLambdaAsync } = await import('../utils/lambda');
    let remaining = 300_000;

    const handler = createLambdaHandler({
      timeoutThresholdMs: 60_000,
      createConfig: () => ({
        migrations: [
          {
            id: '20250601_first',
            migration: {
              name: 'first',
              up: async () => {
                remaining = 30_000;
              },
              down: async () => {},
            },
          },
          {
            id: '20250602_second',
            migration: { name: 'second', up: async () => {}, down: async () => {} },
          },
        ],
        storage,
        context: {},
      }),
    });

    const result = await handler(
      {},
      createMockContext({ getRemainingTimeInMillis: () => remaining }),
    );

    expect(result).toHaveProperty('status', 'needs_continuation');
    expect(invokeLambdaAsync).toHaveBeenCalledWith(
      'test-migration-fn',
      expect.objectContaining({ direction: 'up', depth: 1 }),
    );
  });

  it('uses custom function name over context.functionName', async () => {
    const { invokeLambdaAsync } = await import('../utils/lambda');
    let remaining = 300_000;

    const handler = createLambdaHandler({
      functionName: 'custom-fn-name',
      timeoutThresholdMs: 60_000,
      createConfig: () => ({
        migrations: [
          {
            id: '20250601_first',
            migration: {
              name: 'first',
              up: async () => {
                remaining = 30_000;
              },
              down: async () => {},
            },
          },
          {
            id: '20250602_second',
            migration: { name: 'second', up: async () => {}, down: async () => {} },
          },
        ],
        storage,
        context: {},
      }),
    });

    await handler({}, createMockContext({ getRemainingTimeInMillis: () => remaining }));

    expect(invokeLambdaAsync).toHaveBeenCalledWith('custom-fn-name', expect.anything());
  });

  it('supports async createConfig (returns Promise)', async () => {
    const upFn = vi.fn().mockResolvedValue(undefined);
    const handler = createLambdaHandler({
      createConfig: async () => ({
        migrations: [
          {
            id: '20250601_first',
            migration: { name: 'first', up: upFn, down: async () => {} },
          },
        ],
        storage,
        context: {},
      }),
    });

    const result = await handler({}, createMockContext());

    expect(upFn).toHaveBeenCalledOnce();
    expect(result).toHaveProperty('status', 'completed');
  });

  it('rejects invalid direction', async () => {
    const handler = createLambdaHandler({
      createConfig: () => ({
        migrations: [],
        storage,
        context: {},
      }),
    });

    const result = await handler({ direction: 'sideways' }, createMockContext());

    expect(result).toHaveProperty('status', 'failed');
    expect(result).toHaveProperty('error', expect.stringContaining('Invalid direction'));
  });

  it('fails when continuation depth limit is exceeded', async () => {
    const handler = createLambdaHandler({
      maxContinuationDepth: 5,
      createConfig: () => ({
        migrations: [
          {
            id: '20250601_first',
            migration: { name: 'first', up: async () => {}, down: async () => {} },
          },
        ],
        storage,
        context: {},
      }),
    });

    const result = await handler({ depth: 5 }, createMockContext());

    expect(result).toHaveProperty('status', 'failed');
    expect(result).toHaveProperty('error', expect.stringContaining('depth limit exceeded'));
  });

  it('passes depth through on continuation', async () => {
    const { invokeLambdaAsync } = await import('../utils/lambda');
    let remaining = 300_000;

    const handler = createLambdaHandler({
      timeoutThresholdMs: 60_000,
      createConfig: () => ({
        migrations: [
          {
            id: '20250601_first',
            migration: {
              name: 'first',
              up: async () => {
                remaining = 30_000;
              },
              down: async () => {},
            },
          },
          {
            id: '20250602_second',
            migration: { name: 'second', up: async () => {}, down: async () => {} },
          },
        ],
        storage,
        context: {},
      }),
    });

    await handler({ depth: 3 }, createMockContext({ getRemainingTimeInMillis: () => remaining }));

    expect(invokeLambdaAsync).toHaveBeenCalledWith(
      'test-migration-fn',
      expect.objectContaining({ depth: 4 }),
    );
  });

  it('handles down direction with needs_continuation', async () => {
    const { invokeLambdaAsync } = await import('../utils/lambda');
    let remaining = 300_000;

    vi.mocked(storage.getAllRecords).mockResolvedValue([
      {
        id: '20250601_first',
        name: 'first',
        status: 'completed',
        direction: 'up',
        startedAt: 1000,
        executionId: 'exec-1',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: '20250602_second',
        name: 'second',
        status: 'completed',
        direction: 'up',
        startedAt: 1001,
        executionId: 'exec-1',
        createdAt: 1001,
        updatedAt: 1001,
      },
    ]);

    const handler = createLambdaHandler({
      timeoutThresholdMs: 60_000,
      createConfig: () => ({
        migrations: [
          {
            id: '20250601_first',
            migration: {
              name: 'first',
              up: async () => {},
              down: async () => {},
            },
          },
          {
            id: '20250602_second',
            migration: {
              name: 'second',
              up: async () => {},
              down: async () => {
                remaining = 30_000;
              },
            },
          },
        ],
        storage,
        context: {},
      }),
    });

    const result = await handler(
      { direction: 'down', target: '20250601_first' },
      createMockContext({ getRemainingTimeInMillis: () => remaining }),
    );

    expect(result).toHaveProperty('status', 'needs_continuation');
    expect(invokeLambdaAsync).toHaveBeenCalledWith(
      'test-migration-fn',
      expect.objectContaining({ direction: 'down' }),
    );
  });
});
