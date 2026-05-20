import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runMigrationsInFargate } from './fargate-runner';

import type { MigrationStorage } from '../types';

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

describe('runMigrationsInFargate', () => {
  const originalEnv = { ...process.env };
  let storage: MigrationStorage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it('runs migrations up by default', async () => {
    delete process.env.MIGRATION_DIRECTION;
    delete process.env.MIGRATION_TARGET;

    const upFn = vi.fn().mockResolvedValue(undefined);

    const result = await runMigrationsInFargate({
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

    expect(upFn).toHaveBeenCalledOnce();
    expect(result.status).toBe('completed');
  });

  it('reads direction from MIGRATION_DIRECTION env var', async () => {
    process.env.MIGRATION_DIRECTION = 'down';
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
    const result = await runMigrationsInFargate({
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

    expect(downFn).toHaveBeenCalledOnce();
    expect(result.status).toBe('completed');
  });

  it('reads target from MIGRATION_TARGET env var', async () => {
    delete process.env.MIGRATION_DIRECTION;
    process.env.MIGRATION_TARGET = '20250601_first';

    const upFn1 = vi.fn().mockResolvedValue(undefined);
    const upFn2 = vi.fn().mockResolvedValue(undefined);

    await runMigrationsInFargate({
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

    expect(upFn1).toHaveBeenCalledOnce();
    expect(upFn2).not.toHaveBeenCalled();
  });

  it('treats empty MIGRATION_TARGET as "no target"', async () => {
    delete process.env.MIGRATION_DIRECTION;
    process.env.MIGRATION_TARGET = '';

    const upFn1 = vi.fn().mockResolvedValue(undefined);
    const upFn2 = vi.fn().mockResolvedValue(undefined);

    await runMigrationsInFargate({
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

    expect(upFn1).toHaveBeenCalledOnce();
    expect(upFn2).toHaveBeenCalledOnce();
  });

  it('explicit options override env vars', async () => {
    process.env.MIGRATION_DIRECTION = 'down';
    process.env.MIGRATION_TARGET = '20250601_first';

    const upFn = vi.fn().mockResolvedValue(undefined);

    await runMigrationsInFargate({
      direction: 'up',
      target: undefined,
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

    expect(upFn).toHaveBeenCalledOnce();
  });

  it('throws on invalid MIGRATION_DIRECTION', async () => {
    process.env.MIGRATION_DIRECTION = 'sideways';

    await expect(
      runMigrationsInFargate({
        createConfig: () => ({
          migrations: [],
          storage,
          context: {},
        }),
      }),
    ).rejects.toThrow(/Invalid MIGRATION_DIRECTION/);
  });

  it('reads executionId from MIGRATION_EXECUTION_ID env var', async () => {
    delete process.env.MIGRATION_DIRECTION;
    delete process.env.MIGRATION_TARGET;
    process.env.MIGRATION_EXECUTION_ID = 'env-exec-id';

    const result = await runMigrationsInFargate({
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

    expect(result.executionId).toBe('env-exec-id');
    // Per-migration record carries the env-supplied id.
    expect(storage.createRecord).toHaveBeenCalledWith(
      expect.objectContaining({ id: '20250601_first', executionId: 'env-exec-id' }),
    );
  });

  it('falls back to a generated executionId when MIGRATION_EXECUTION_ID is unset', async () => {
    delete process.env.MIGRATION_DIRECTION;
    delete process.env.MIGRATION_TARGET;
    delete process.env.MIGRATION_EXECUTION_ID;

    const result = await runMigrationsInFargate({
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

    expect(result.executionId).toHaveLength(36);
  });

  it('explicit executionId option overrides MIGRATION_EXECUTION_ID env', async () => {
    delete process.env.MIGRATION_DIRECTION;
    delete process.env.MIGRATION_TARGET;
    process.env.MIGRATION_EXECUTION_ID = 'env-id';

    const result = await runMigrationsInFargate({
      executionId: 'option-id',
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

    expect(result.executionId).toBe('option-id');
  });

  it('does NOT inject a timeoutManager (runs to completion)', async () => {
    delete process.env.MIGRATION_DIRECTION;
    delete process.env.MIGRATION_TARGET;

    let observedTimeoutManager: unknown = 'unset';

    const result = await runMigrationsInFargate({
      createConfig: () => ({
        migrations: [
          {
            id: '20250601_first',
            migration: {
              name: 'first',
              // The runner exposes the context (with timeoutManager if set).
              // Capture it from inside `up()` to assert no manager is wired.
              up: async (ctx: { timeoutManager?: unknown }) => {
                observedTimeoutManager = ctx.timeoutManager;
              },
              down: async () => {},
            },
          },
        ],
        storage,
        context: {},
      }),
    });

    expect(result.status).toBe('completed');
    expect(observedTimeoutManager).toBeUndefined();
  });
});
