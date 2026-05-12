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

  describe('dispatcher mode (dispatchTo)', () => {
    it('returns no_work and skips dispatch when up has no pending migrations', async () => {
      // All migrations marked completed in storage so status() reports zero pending.
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        {
          id: '20250601_first',
          name: 'first',
          status: 'completed',
          direction: 'up',
          startedAt: 1000,
          executionId: 'prior-exec',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]);

      const dispatchTo = vi.fn().mockResolvedValue(undefined);
      const upFn = vi.fn();

      const handler = createLambdaHandler({
        dispatchTo,
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

      expect(result).toMatchObject({ status: 'no_work' });
      expect(dispatchTo).not.toHaveBeenCalled();
      expect(upFn).not.toHaveBeenCalled(); // dispatcher MUST NOT run inline
    });

    it('dispatches when up has pending migrations and returns dispatched', async () => {
      const dispatchTo = vi.fn().mockResolvedValue(undefined);
      const upFn = vi.fn();

      const handler = createLambdaHandler({
        dispatchTo,
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

      expect(result).toMatchObject({ status: 'dispatched' });
      expect(dispatchTo).toHaveBeenCalledTimes(1);
      expect(dispatchTo).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'up', target: undefined }),
      );
      expect(upFn).not.toHaveBeenCalled(); // dispatcher MUST NOT run inline
    });

    it('always dispatches for direction=down regardless of pending', async () => {
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        {
          id: '20250601_first',
          name: 'first',
          status: 'completed',
          direction: 'up',
          startedAt: 1000,
          executionId: 'prior-exec',
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]);

      const dispatchTo = vi.fn().mockResolvedValue(undefined);
      const handler = createLambdaHandler({
        dispatchTo,
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

      const result = await handler({ direction: 'down' }, createMockContext());

      expect(result).toMatchObject({ status: 'dispatched' });
      expect(dispatchTo).toHaveBeenCalledWith(expect.objectContaining({ direction: 'down' }));
    });

    it('forwards target to the dispatchTo callback', async () => {
      const dispatchTo = vi.fn().mockResolvedValue(undefined);
      const handler = createLambdaHandler({
        dispatchTo,
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

      await handler({ target: '20250601_first' }, createMockContext());

      expect(dispatchTo).toHaveBeenCalledWith(
        expect.objectContaining({ target: '20250601_first' }),
      );
    });

    it('keeps action=status inline even with dispatchTo set', async () => {
      const dispatchTo = vi.fn().mockResolvedValue(undefined);
      const handler = createLambdaHandler({
        dispatchTo,
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
      expect(dispatchTo).not.toHaveBeenCalled();
    });

    it('does not self-reinvoke in dispatcher mode (no needs_continuation path)', async () => {
      const { invokeLambdaAsync } = await import('../utils/lambda');
      const dispatchTo = vi.fn().mockResolvedValue(undefined);

      const handler = createLambdaHandler({
        dispatchTo,
        timeoutThresholdMs: 60_000,
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

      // Even with low remaining time the dispatcher must not invoke the
      // continuation Lambda — Fargate runs to completion, no chunking needed.
      await handler({}, createMockContext({ getRemainingTimeInMillis: () => 10_000 }));

      expect(invokeLambdaAsync).not.toHaveBeenCalled();
    });
  });

  describe('ECS task-stopped events (EventBridge)', () => {
    function buildEvent(overrides?: {
      exitCode?: number;
      executionId?: string;
      direction?: 'up' | 'down';
      stoppedReason?: string;
      lastStatus?: string;
      includeEnv?: boolean;
    }) {
      const env: { name: string; value: string }[] = [];
      if (overrides?.includeEnv !== false) {
        if (overrides?.executionId !== undefined) {
          env.push({ name: 'MIGRATION_EXECUTION_ID', value: overrides.executionId });
        }
        if (overrides?.direction !== undefined) {
          env.push({ name: 'MIGRATION_DIRECTION', value: overrides.direction });
        }
      }
      return {
        source: 'aws.ecs',
        'detail-type': 'ECS Task State Change',
        detail: {
          taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/cluster/abc123',
          lastStatus: overrides?.lastStatus ?? 'STOPPED',
          stoppedReason: overrides?.stoppedReason,
          containers: [{ exitCode: overrides?.exitCode }],
          overrides: { containerOverrides: [{ environment: env }] },
        },
      };
    }

    it('records execution:latest failed row when task exits non-zero', async () => {
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

      const event = buildEvent({
        exitCode: 1,
        executionId: 'exec-abc',
        direction: 'up',
        stoppedReason: 'Essential container exited',
      });

      const result = await handler(event as never, createMockContext());

      expect(result).toEqual({ status: 'recorded' });
      expect(storage.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          // Fixed id (not `execution:<uuid>`) so put() overwrites prior runs.
          id: 'execution:latest',
          status: 'failed',
          direction: 'up',
          // Synthetic executionId so the SK composite also collapses.
          executionId: 'latest',
          name: 'execution-exec-abc',
          metadata: { runtimeExecutionId: 'exec-abc' },
          error: 'Essential container exited',
          taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/cluster/abc123',
        }),
      );
    });

    it('falls back to exit code in error when stoppedReason is absent', async () => {
      const handler = createLambdaHandler({
        createConfig: () => ({ migrations: [], storage, context: {} }),
      });

      const event = buildEvent({ exitCode: 137, executionId: 'exec-1', direction: 'up' });

      await handler(event as never, createMockContext());

      expect(storage.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Fargate task exited with code 137',
        }),
      );
    });

    it('writes execution:latest completed row on clean exit so prior failures clear', async () => {
      const handler = createLambdaHandler({
        createConfig: () => ({ migrations: [], storage, context: {} }),
      });

      const event = buildEvent({ exitCode: 0, executionId: 'exec-2', direction: 'up' });
      const result = await handler(event as never, createMockContext());

      expect(result).toEqual({ status: 'ignored' });
      // Must still write — overwriting any stale `failed` row from a prior
      // broken run. This is what makes successful retries self-healing.
      expect(storage.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'execution:latest',
          status: 'completed',
          executionId: 'latest',
          error: undefined,
        }),
      );
    });

    it('ignores events without migration env overrides (not one of our tasks)', async () => {
      const handler = createLambdaHandler({
        createConfig: () => ({ migrations: [], storage, context: {} }),
      });

      const event = buildEvent({ exitCode: 1, includeEnv: false });
      const result = await handler(event as never, createMockContext());

      expect(result).toEqual({ status: 'ignored' });
      expect(storage.createRecord).not.toHaveBeenCalled();
    });

    it('ignores events for tasks that are not STOPPED', async () => {
      const handler = createLambdaHandler({
        createConfig: () => ({ migrations: [], storage, context: {} }),
      });

      const event = buildEvent({
        exitCode: 1,
        executionId: 'exec-3',
        direction: 'up',
        lastStatus: 'PROVISIONING',
      });
      const result = await handler(event as never, createMockContext());

      expect(result).toEqual({ status: 'ignored' });
      expect(storage.createRecord).not.toHaveBeenCalled();
    });

    it('execution:latest failed row surfaces in status().failed via the standard path', async () => {
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        {
          id: 'execution:latest',
          name: 'execution-exec-zzz',
          status: 'failed',
          direction: 'up',
          startedAt: 5000,
          completedAt: 5000,
          executionId: 'latest',
          error: 'task exited 1',
          taskArn: 'arn:aws:ecs:us-east-1:123:task/x',
          createdAt: 5000,
          updatedAt: 5000,
        },
      ]);

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

      expect(result).toHaveProperty('failed');
      expect((result as { failed: string[] }).failed).toContain('execution:latest');
    });

    it('status() filters out stale execution:<uuid> rows from pre-0.4.3 runs', async () => {
      // Backwards compat: existing consumers may have execution:<uuid> rows
      // permanently stuck in failed[] from before the fixed-id rewrite.
      // status() must hide them so upgrading is zero-touch.
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        {
          id: 'execution:143fd061-2a9b-4222-b5f2-da1a80b37eaf',
          name: 'execution-143fd061',
          status: 'failed',
          direction: 'up',
          startedAt: 1000,
          completedAt: 1000,
          executionId: '143fd061-2a9b-4222-b5f2-da1a80b37eaf',
          error: 'EACCES',
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: '20250601_first',
          name: 'first',
          status: 'failed',
          direction: 'up',
          startedAt: 2000,
          completedAt: 2000,
          executionId: 'exec-real',
          createdAt: 2000,
          updatedAt: 2000,
        },
      ]);

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
      const failed = (result as { failed: string[] }).failed;

      // Real per-migration failure is still surfaced.
      expect(failed).toContain('20250601_first');
      // Stale execution:<uuid> row is hidden.
      expect(failed).not.toContain('execution:143fd061-2a9b-4222-b5f2-da1a80b37eaf');
    });
  });
});
