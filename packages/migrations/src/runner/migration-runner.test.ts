import { describe, it, expect, vi } from 'vitest';

import { MigrationRunner } from './migration-runner';

import type {
  Migration,
  MigrationEntry,
  MigrationRecord,
  MigrationRunnerConfig,
  MigrationStorage,
} from '../types';

function makeMigration(
  name: string,
  opts?: { upFn?: () => Promise<unknown>; downFn?: () => Promise<unknown> },
): Migration {
  return {
    name,
    up: opts?.upFn ?? (async () => {}),
    down: opts?.downFn ?? (async () => {}),
  };
}

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

function createConfig(
  migrations: MigrationEntry[],
  storage?: MigrationStorage,
): MigrationRunnerConfig {
  return {
    migrations,
    storage: storage ?? createMockStorage(),
    context: {},
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  };
}

describe('MigrationRunner', () => {
  describe('up', () => {
    it('runs all pending migrations', async () => {
      const upFn1 = vi.fn().mockResolvedValue(undefined);
      const upFn2 = vi.fn().mockResolvedValue(undefined);
      const config = createConfig([
        { id: '20250601_first', migration: makeMigration('first', { upFn: upFn1 }) },
        { id: '20250602_second', migration: makeMigration('second', { upFn: upFn2 }) },
      ]);

      const runner = new MigrationRunner(config);
      const result = await runner.up();

      expect(result.status).toBe('completed');
      expect(result.migrationsRun).toEqual(['20250601_first', '20250602_second']);
      expect(result.migrationsRemaining).toEqual([]);
      expect(upFn1).toHaveBeenCalledOnce();
      expect(upFn2).toHaveBeenCalledOnce();
    });

    it('skips already completed migrations', async () => {
      const storage = createMockStorage();
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        makeRecord({ id: '20250601_first', status: 'completed', direction: 'up' }),
      ]);

      const upFn = vi.fn().mockResolvedValue(undefined);
      const config = createConfig(
        [
          { id: '20250601_first', migration: makeMigration('first') },
          { id: '20250602_second', migration: makeMigration('second', { upFn }) },
        ],
        storage,
      );

      const runner = new MigrationRunner(config);
      const result = await runner.up();

      expect(result.migrationsRun).toEqual(['20250602_second']);
      expect(upFn).toHaveBeenCalledOnce();
    });

    it('runs up to target when specified', async () => {
      const upFn1 = vi.fn().mockResolvedValue(undefined);
      const upFn2 = vi.fn().mockResolvedValue(undefined);
      const upFn3 = vi.fn().mockResolvedValue(undefined);
      const config = createConfig([
        { id: '20250601_first', migration: makeMigration('first', { upFn: upFn1 }) },
        { id: '20250602_second', migration: makeMigration('second', { upFn: upFn2 }) },
        { id: '20250603_third', migration: makeMigration('third', { upFn: upFn3 }) },
      ]);

      const runner = new MigrationRunner(config);
      const result = await runner.up('20250602_second');

      expect(result.migrationsRun).toEqual(['20250601_first', '20250602_second']);
      expect(upFn3).not.toHaveBeenCalled();
    });

    it('throws error when target not found in up()', async () => {
      const config = createConfig([
        { id: '20250601_first', migration: makeMigration('first') },
        { id: '20250602_second', migration: makeMigration('second') },
      ]);

      const runner = new MigrationRunner(config);
      const result = await runner.up('nonexistent_target');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Target migration not found: nonexistent_target');
    });

    it('returns completed with empty list when nothing to run', async () => {
      const storage = createMockStorage();
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        makeRecord({ id: '20250601_first', status: 'completed', direction: 'up' }),
      ]);

      const config = createConfig(
        [{ id: '20250601_first', migration: makeMigration('first') }],
        storage,
      );

      const runner = new MigrationRunner(config);
      const result = await runner.up();

      expect(result.status).toBe('completed');
      expect(result.migrationsRun).toEqual([]);
    });

    it('stops and returns failed on migration error', async () => {
      const upFn1 = vi.fn().mockResolvedValue(undefined);
      const upFn2 = vi.fn().mockRejectedValue(new Error('Migration failed'));
      const upFn3 = vi.fn().mockResolvedValue(undefined);

      const config = createConfig([
        { id: '20250601_first', migration: makeMigration('first', { upFn: upFn1 }) },
        { id: '20250602_second', migration: makeMigration('second', { upFn: upFn2 }) },
        { id: '20250603_third', migration: makeMigration('third', { upFn: upFn3 }) },
      ]);

      const runner = new MigrationRunner(config);
      const result = await runner.up();

      expect(result.status).toBe('failed');
      expect(result.migrationsRun).toEqual(['20250601_first']);
      expect(result.migrationsRemaining).toEqual(['20250603_third']);
      expect(result.error).toContain('Migration failed');
      expect(upFn3).not.toHaveBeenCalled();
    });

    it('creates and updates records for each migration', async () => {
      const storage = createMockStorage();
      const config = createConfig(
        [{ id: '20250601_first', migration: makeMigration('first') }],
        storage,
      );

      const runner = new MigrationRunner(config);
      await runner.up();

      expect(storage.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '20250601_first',
          status: 'running',
          direction: 'up',
        }),
      );
      expect(storage.updateRecord).toHaveBeenCalledWith(
        '20250601_first',
        'up',
        expect.any(String),
        expect.objectContaining({
          status: 'completed',
        }),
      );
    });

    it('records failed status on migration error', async () => {
      const storage = createMockStorage();
      const config = createConfig(
        [
          {
            id: '20250601_first',
            migration: makeMigration('first', {
              upFn: async () => {
                throw new Error('boom');
              },
            }),
          },
        ],
        storage,
      );

      const runner = new MigrationRunner(config);
      await runner.up();

      expect(storage.updateRecord).toHaveBeenCalledWith(
        '20250601_first',
        'up',
        expect.any(String),
        expect.objectContaining({
          status: 'failed',
          error: 'boom',
        }),
      );
    });

    it('passes context to migration functions', async () => {
      const upFn = vi.fn().mockResolvedValue(undefined);
      const context = { db: 'test-db' };
      const config: MigrationRunnerConfig = {
        migrations: [{ id: '20250601_first', migration: makeMigration('first', { upFn }) }],
        storage: createMockStorage(),
        context,
      };

      const runner = new MigrationRunner(config);
      await runner.up();

      expect(upFn).toHaveBeenCalledWith(context);
    });

    it('stores metadata returned from migration', async () => {
      const storage = createMockStorage();
      const meta = { rowsAffected: 42 };
      const config = createConfig(
        [
          {
            id: '20250601_first',
            migration: makeMigration('first', {
              upFn: async () => meta,
            }),
          },
        ],
        storage,
      );

      const runner = new MigrationRunner(config);
      await runner.up();

      expect(storage.updateRecord).toHaveBeenCalledWith(
        '20250601_first',
        'up',
        expect.any(String),
        expect.objectContaining({
          status: 'completed',
          metadata: meta,
        }),
      );
    });

    it('captures output written via ctx.log on the record', async () => {
      const storage = createMockStorage();
      const config = createConfig(
        [
          {
            id: '20250601_first',
            migration: makeMigration('first', {
              upFn: async () => {},
            }),
          },
        ],
        storage,
      );
      // Override the migration to use the runtime-injected ctx.log
      config.migrations = [
        {
          id: '20250601_first',
          migration: {
            name: 'first',
            up: async (ctx) => {
              ctx.log?.('migrated 42 rows');
            },
            down: async () => {},
          },
        },
      ];

      const runner = new MigrationRunner(config);
      await runner.up();

      const updateCalls = vi.mocked(storage.updateRecord).mock.calls;
      const [, , , updates] = updateCalls[updateCalls.length - 1];
      expect(updates.output).toContain('migrated 42 rows');
      expect(updates.outputTruncated).toBeUndefined();
    });

    it('captures output written via console.log directly', async () => {
      const storage = createMockStorage();
      const config = createConfig(
        [
          {
            id: '20250601_first',
            migration: {
              name: 'first',
              up: async () => {
                // eslint-disable-next-line no-console
                console.log('teed line', { foo: 'bar' });
              },
              down: async () => {},
            },
          },
        ],
        storage,
      );

      const runner = new MigrationRunner(config);
      await runner.up();

      const updateCalls = vi.mocked(storage.updateRecord).mock.calls;
      const [, , , updates] = updateCalls[updateCalls.length - 1];
      expect(updates.output).toContain('teed line');
      expect(updates.output).toContain("foo: 'bar'");
    });

    it('still persists captured output when migration fails', async () => {
      const storage = createMockStorage();
      const config = createConfig(
        [
          {
            id: '20250601_first',
            migration: {
              name: 'first',
              up: async (ctx) => {
                ctx.log?.('halfway done');
                throw new Error('boom');
              },
              down: async () => {},
            },
          },
        ],
        storage,
      );

      const runner = new MigrationRunner(config);
      await runner.up();

      const updateCalls = vi.mocked(storage.updateRecord).mock.calls;
      const [, , , updates] = updateCalls[updateCalls.length - 1];
      expect(updates.status).toBe('failed');
      expect(updates.output).toContain('halfway done');
    });

    it('restores console after migration completes', async () => {
      const storage = createMockStorage();
      // eslint-disable-next-line no-console
      const original = console.log;
      const config = createConfig(
        [
          {
            id: '20250601_first',
            migration: {
              name: 'first',
              up: async () => {
                // eslint-disable-next-line no-console
                console.log('captured');
              },
              down: async () => {},
            },
          },
        ],
        storage,
      );

      const runner = new MigrationRunner(config);
      await runner.up();

      // eslint-disable-next-line no-console
      expect(console.log).toBe(original);
    });

    it('snapshots migration description onto the record at run time', async () => {
      const storage = createMockStorage();
      const description = '## What this does\n\nBackfills the `tenantId` GSI.';
      const migration: Migration = {
        name: 'first',
        description,
        up: async () => {},
        down: async () => {},
      };
      const config = createConfig([{ id: '20250601_first', migration }], storage);

      const runner = new MigrationRunner(config);
      await runner.up();

      expect(storage.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '20250601_first',
          description,
        }),
      );
    });

    it('handles non-Error thrown in migration (string throw)', async () => {
      const storage = createMockStorage();
      const config = createConfig(
        [
          {
            id: '20250601_first',
            migration: makeMigration('first', {
              upFn: async () => {
                throw 'string error';
              },
            }),
          },
        ],
        storage,
      );

      const runner = new MigrationRunner(config);
      const result = await runner.up();

      expect(result.status).toBe('failed');
      expect(result.error).toContain('string error');
      expect(storage.updateRecord).toHaveBeenCalledWith(
        '20250601_first',
        'up',
        expect.any(String),
        expect.objectContaining({
          status: 'failed',
          error: 'string error',
        }),
      );
    });
  });

  describe('down', () => {
    it('rolls back only the last migration when no target is specified', async () => {
      const storage = createMockStorage();
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        makeRecord({ id: '20250601_first', status: 'completed', direction: 'up' }),
        makeRecord({ id: '20250602_second', status: 'completed', direction: 'up' }),
      ]);

      const downFn1 = vi.fn().mockResolvedValue(undefined);
      const downFn2 = vi.fn().mockResolvedValue(undefined);

      const config = createConfig(
        [
          { id: '20250601_first', migration: makeMigration('first', { downFn: downFn1 }) },
          { id: '20250602_second', migration: makeMigration('second', { downFn: downFn2 }) },
        ],
        storage,
      );

      const runner = new MigrationRunner(config);
      const result = await runner.down();

      expect(result.status).toBe('completed');
      // Only the most recent should be rolled back
      expect(result.migrationsRun).toEqual(['20250602_second']);
      expect(downFn1).not.toHaveBeenCalled();
    });

    it('rolls back down to target when specified', async () => {
      const storage = createMockStorage();
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        makeRecord({ id: '20250601_first', status: 'completed', direction: 'up' }),
        makeRecord({ id: '20250602_second', status: 'completed', direction: 'up' }),
        makeRecord({ id: '20250603_third', status: 'completed', direction: 'up' }),
      ]);

      const downFn1 = vi.fn().mockResolvedValue(undefined);
      const downFn2 = vi.fn().mockResolvedValue(undefined);
      const downFn3 = vi.fn().mockResolvedValue(undefined);

      const config = createConfig(
        [
          { id: '20250601_first', migration: makeMigration('first', { downFn: downFn1 }) },
          { id: '20250602_second', migration: makeMigration('second', { downFn: downFn2 }) },
          { id: '20250603_third', migration: makeMigration('third', { downFn: downFn3 }) },
        ],
        storage,
      );

      const runner = new MigrationRunner(config);
      const result = await runner.down('20250602_second');

      expect(result.migrationsRun).toEqual(['20250603_third', '20250602_second']);
      expect(downFn1).not.toHaveBeenCalled();
    });

    it('throws error when target not found in down()', async () => {
      const storage = createMockStorage();
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        makeRecord({ id: '20250601_first', status: 'completed', direction: 'up' }),
      ]);

      const config = createConfig(
        [{ id: '20250601_first', migration: makeMigration('first') }],
        storage,
      );

      const runner = new MigrationRunner(config);
      const result = await runner.down('nonexistent_target');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Target migration not found: nonexistent_target');
    });

    it('returns completed with empty list when nothing to roll back', async () => {
      const config = createConfig([{ id: '20250601_first', migration: makeMigration('first') }]);

      const runner = new MigrationRunner(config);
      const result = await runner.down();

      expect(result.status).toBe('completed');
      expect(result.migrationsRun).toEqual([]);
    });

    it('stops and returns failed on down migration error', async () => {
      const storage = createMockStorage();
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        makeRecord({ id: '20250601_first', status: 'completed', direction: 'up' }),
        makeRecord({ id: '20250602_second', status: 'completed', direction: 'up' }),
      ]);

      const config = createConfig(
        [
          { id: '20250601_first', migration: makeMigration('first') },
          {
            id: '20250602_second',
            migration: makeMigration('second', {
              downFn: async () => {
                throw new Error('rollback failed');
              },
            }),
          },
        ],
        storage,
      );

      const runner = new MigrationRunner(config);
      const result = await runner.down('20250601_first');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('rollback failed');
    });

    it('creates and updates records for down migration', async () => {
      const storage = createMockStorage();
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        makeRecord({ id: '20250601_first', status: 'completed', direction: 'up' }),
      ]);

      const config = createConfig(
        [{ id: '20250601_first', migration: makeMigration('first') }],
        storage,
      );

      const runner = new MigrationRunner(config);
      await runner.down();

      expect(storage.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '20250601_first',
          status: 'running',
          direction: 'down',
        }),
      );
      expect(storage.updateRecord).toHaveBeenCalledWith(
        '20250601_first',
        'down',
        expect.any(String),
        expect.objectContaining({
          status: 'completed',
        }),
      );
    });
  });

  describe('status', () => {
    it('returns pending, completed, and failed lists', async () => {
      const storage = createMockStorage();
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        makeRecord({ id: '20250601_first', status: 'completed', direction: 'up' }),
      ]);

      const config = createConfig(
        [
          { id: '20250601_first', migration: makeMigration('first') },
          { id: '20250602_second', migration: makeMigration('second') },
          { id: '20250603_third', migration: makeMigration('third') },
        ],
        storage,
      );

      const runner = new MigrationRunner(config);
      const result = await runner.status();

      expect(result.completed).toEqual(['20250601_first']);
      expect(result.pending).toEqual(['20250602_second', '20250603_third']);
      expect(result.failed).toEqual([]);
    });

    it('returns all empty when no migrations exist', async () => {
      const config = createConfig([]);
      const runner = new MigrationRunner(config);
      const result = await runner.status();

      expect(result).toEqual({ pending: [], completed: [], failed: [] });
    });

    it('uses latest record to determine failed status (not raw getRecordsByStatus)', async () => {
      const storage = createMockStorage();
      // Migration failed initially, then succeeded — latest is completed
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        makeRecord({ id: '20250601_first', status: 'failed', direction: 'up', createdAt: 100 }),
        makeRecord({ id: '20250601_first', status: 'completed', direction: 'up', createdAt: 200 }),
      ]);

      const config = createConfig(
        [{ id: '20250601_first', migration: makeMigration('first') }],
        storage,
      );

      const runner = new MigrationRunner(config);
      const result = await runner.status();

      expect(result.completed).toEqual(['20250601_first']);
      expect(result.failed).toEqual([]);
    });

    it('reports failed when latest record is failed', async () => {
      const storage = createMockStorage();
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        makeRecord({ id: '20250601_first', status: 'completed', direction: 'up', createdAt: 100 }),
        makeRecord({ id: '20250601_first', status: 'failed', direction: 'up', createdAt: 200 }),
      ]);

      const config = createConfig(
        [{ id: '20250601_first', migration: makeMigration('first') }],
        storage,
      );

      const runner = new MigrationRunner(config);
      const result = await runner.status();

      expect(result.failed).toEqual(['20250601_first']);
    });
  });

  describe('timeout handling', () => {
    it('stops execution when timeout is approaching', async () => {
      let shouldStop = false;
      const config = createConfig([
        {
          id: '20250601_first',
          migration: makeMigration('first', {
            upFn: async () => {
              shouldStop = true;
            },
          }),
        },
        { id: '20250602_second', migration: makeMigration('second') },
      ]);
      config.timeoutManager = {
        threshold: 60_000,
        getRemainingTimeMs: () => (shouldStop ? 30_000 : 120_000),
        shouldStop: () => shouldStop,
      };

      const runner = new MigrationRunner(config);
      const result = await runner.up();

      expect(result.status).toBe('needs_continuation');
      expect(result.migrationsRun).toEqual(['20250601_first']);
      expect(result.migrationsRemaining).toEqual(['20250602_second']);
    });
  });

  describe('re-run after rollback', () => {
    it('runs migration up again after it was rolled back', async () => {
      const storage = createMockStorage();
      // Simulate: migration was migrated up, then rolled back (down completed is latest)
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        makeRecord({ id: '20250601_first', status: 'completed', direction: 'up', createdAt: 100 }),
        makeRecord({
          id: '20250601_first',
          status: 'completed',
          direction: 'down',
          createdAt: 200,
        }),
      ]);

      const upFn = vi.fn().mockResolvedValue(undefined);
      const config = createConfig(
        [{ id: '20250601_first', migration: makeMigration('first', { upFn }) }],
        storage,
      );

      const runner = new MigrationRunner(config);
      const result = await runner.up();

      expect(result.status).toBe('completed');
      expect(result.migrationsRun).toEqual(['20250601_first']);
      expect(upFn).toHaveBeenCalledOnce();
      expect(storage.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '20250601_first',
          status: 'running',
          direction: 'up',
        }),
      );
    });
  });

  describe('stale migration handling', () => {
    it('marks stale running migration as failed before re-running', async () => {
      const storage = createMockStorage();
      vi.mocked(storage.getRecord).mockResolvedValue(
        makeRecord({ id: '20250601_first', status: 'running', direction: 'up' }),
      );

      const config = createConfig(
        [{ id: '20250601_first', migration: makeMigration('first') }],
        storage,
      );

      const runner = new MigrationRunner(config);
      await runner.up();

      // First updateRecord call should mark the stale migration as failed
      expect(storage.updateRecord).toHaveBeenNthCalledWith(
        1,
        '20250601_first',
        'up',
        'exec-1',
        expect.objectContaining({
          status: 'failed',
          error: expect.stringContaining('running state'),
        }),
      );
    });

    it('uses direction from existing record (not the current direction)', async () => {
      const storage = createMockStorage();
      // The stale record has direction 'up', but we're running 'down'
      vi.mocked(storage.getRecord).mockResolvedValue(
        makeRecord({ id: '20250601_first', status: 'running', direction: 'up' }),
      );
      vi.mocked(storage.getAllRecords).mockResolvedValue([
        makeRecord({ id: '20250601_first', status: 'completed', direction: 'up' }),
      ]);

      const config = createConfig(
        [{ id: '20250601_first', migration: makeMigration('first') }],
        storage,
      );

      const runner = new MigrationRunner(config);
      await runner.down();

      // handleStaleMigration should use existing.direction ('up'), not current direction ('down')
      expect(storage.updateRecord).toHaveBeenCalledWith(
        '20250601_first',
        'up',
        'exec-1',
        expect.objectContaining({
          status: 'failed',
          error: expect.stringContaining('running state'),
        }),
      );
    });

    it('passes direction to getRecord for stale check', async () => {
      const storage = createMockStorage();
      const config = createConfig(
        [{ id: '20250601_first', migration: makeMigration('first') }],
        storage,
      );

      const runner = new MigrationRunner(config);
      await runner.up();

      expect(storage.getRecord).toHaveBeenCalledWith('20250601_first', 'up');
    });
  });
});
