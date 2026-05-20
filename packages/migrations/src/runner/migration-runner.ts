import { v4 as uuidv4 } from 'uuid';

import { getCompletedMigrationIds, getLatestRecordPerMigration } from '../utils/records';

import { loadMigrations } from './migration-loader';
import { OutputBuffer } from './output-buffer';
import { EXECUTION_ROW_ID, dispatchSentinelId, isDispatchSentinelId } from './task-stopped';

import type {
  ExecutionMigrationStatus,
  ExecutionResult,
  ExecutionStatus,
  MigrationContext,
  MigrationDirection,
  MigrationEntry,
  MigrationFile,
  MigrationLogger,
  MigrationRecord,
  MigrationRunnerConfig,
  RunOptions,
} from '../types';

const defaultLogger: MigrationLogger = {
  info: (message, data) => {
    // eslint-disable-next-line no-console
    console.log(`[migrations] ${message}`, data ?? '');
  },
  error: (message, data) => {
    console.error(`[migrations] ${message}`, data ?? '');
  },
  warn: (message, data) => {
    console.warn(`[migrations] ${message}`, data ?? '');
  },
  debug: () => {
    /* noop */
  },
};

export class MigrationRunner<TContext extends MigrationContext = MigrationContext> {
  private config: MigrationRunnerConfig<TContext>;
  private logger: MigrationLogger;

  constructor(config: MigrationRunnerConfig<TContext>) {
    this.config = config;
    this.logger = config.logger ?? defaultLogger;
  }

  async up(target?: string, options?: RunOptions): Promise<ExecutionResult> {
    return this.execute('up', target, options);
  }

  async down(target?: string, options?: RunOptions): Promise<ExecutionResult> {
    return this.execute('down', target, options);
  }

  async status(): Promise<{ pending: string[]; completed: string[]; failed: string[] }> {
    const migrations = await this.loadMigrationFiles();
    const completedSet = await this.getCompletedMigrationIds();

    const pending: string[] = [];
    const completed: string[] = [];

    for (const migration of migrations) {
      if (completedSet.has(migration.id)) {
        completed.push(migration.id);
      } else {
        pending.push(migration.id);
      }
    }

    const allRecords = await this.config.storage.getAllRecords();
    const latestById = getLatestRecordPerMigration(allRecords);
    const failed: string[] = [];
    for (const [id, record] of latestById) {
      if (record.status !== 'failed') continue;
      // Pre-0.4.3 task-stopped handler wrote `execution:<uuid>` rows that
      // accumulated forever — different uuid each run meant no put-overwrite
      // and every failed run permanently poisoned `failed[]`. The 0.4.3+
      // handler used the fixed `execution:latest` id so put-overwrite works,
      // but `execution:latest` is last-writer-wins across concurrent runs
      // and conflates outcomes — newer (0.4.4+) callers should use
      // `statusByExecution(executionId)` instead. Keep both filters here for
      // backwards compat: existing consumers don't need to clean their
      // tables to upgrade.
      // EXECUTION_ROW_ID is exported as @deprecated but still consumed here
      // to preserve the existing backwards-compat filter for the 0.4.3 row id.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      if (id.startsWith('execution:') && id !== EXECUTION_ROW_ID) continue;
      // Dispatch sentinels (`dispatch:<uuid>`) are scoped per-execution and
      // shouldn't surface in the global `failed[]` rollup — that's what
      // `statusByExecution` is for. Without this filter, every failed run
      // would permanently poison the dashboard's failed list.
      if (isDispatchSentinelId(id)) continue;
      failed.push(id);
    }

    return { pending, completed, failed };
  }

  /**
   * Returns the rollup status for a single executionId. Used by polling
   * consumers (CI's `run-migrations.ts`, dashboard) that dispatched a run
   * and want to know whether *their* run completed, regardless of what
   * other runs are doing.
   *
   * The dispatch sentinel (`dispatch:<executionId>`) is the source of truth
   * for the overall status when present, but we also walk per-migration
   * records to catch the edge case where the sentinel was never written
   * (e.g. Fargate died at boot, executionId was passed but the runner
   * crashed before writing).
   */
  async statusByExecution(executionId: string): Promise<ExecutionStatus> {
    const records = await this.config.storage.getRecordsByExecutionId(executionId);

    if (records.length === 0) {
      return {
        executionId,
        status: 'not_found',
        migrations: [],
      };
    }

    const sentinelId = dispatchSentinelId(executionId);
    let sentinel: MigrationRecord | undefined;
    const migrations: ExecutionMigrationStatus[] = [];

    for (const record of records) {
      if (record.id === sentinelId) {
        // Keep the most recent sentinel write — sentinel transitions
        // running → completed | failed via `put`, and `updatedAt` is
        // refreshed on every write (entity has `watch: '*'` + `set`).
        if (!sentinel || record.updatedAt > sentinel.updatedAt) {
          sentinel = record;
        }
        continue;
      }
      migrations.push({
        id: record.id,
        status: record.status,
        error: record.error,
      });
    }

    const anyFailed = migrations.find((m) => m.status === 'failed');
    const anyRunning = migrations.find((m) => m.status === 'running');
    const hasMigrations = migrations.length > 0;

    let status: ExecutionStatus['status'];
    let error: string | undefined;

    if (sentinel?.status === 'failed' || anyFailed) {
      status = 'failed';
      error = sentinel?.error ?? anyFailed?.error;
    } else if (sentinel?.status === 'running' || anyRunning) {
      status = 'running';
    } else if (
      sentinel?.status === 'completed' ||
      (hasMigrations && migrations.every((m) => m.status === 'completed'))
    ) {
      status = 'completed';
    } else {
      status = 'running';
    }

    return { executionId, status, migrations, error };
  }

  private async execute(
    direction: MigrationDirection,
    target?: string,
    options?: RunOptions,
  ): Promise<ExecutionResult> {
    // Callers (e.g. the dispatcher Lambda) can pass an executionId so the
    // records this runner writes share the id the caller returned. When
    // omitted, generate one — preserves behavior for inline / ad-hoc runs.
    const executionId = options?.executionId ?? uuidv4();
    const migrationsRun: string[] = [];

    // Track whether *we* started the sentinel (so we own its terminal write)
    // vs. whether it already existed (the dispatcher Lambda wrote it before
    // launching us, or a prior continuation invocation wrote it). Either way
    // we transition it on terminal outcomes; the "already exists" case is
    // just an idempotent re-put.
    await this.upsertSentinel(executionId, direction, 'running');

    try {
      const migrations = await this.loadMigrationFiles();
      const completedSet = await this.getCompletedMigrationIds();

      const plan = this.buildPlan(migrations, completedSet, direction, target);

      if (plan.length === 0) {
        this.logger.info(`No migrations to run (${direction})`);
        await this.upsertSentinel(executionId, direction, 'completed');
        return {
          status: 'completed',
          executionId,
          migrationsRun: [],
          migrationsRemaining: [],
        };
      }

      this.logger.info(`Planning to run ${plan.length} migration(s) (${direction})`, {
        migrations: plan.map((m) => m.id),
      });

      for (let i = 0; i < plan.length; i++) {
        const migrationFile = plan[i];

        if (this.config.timeoutManager?.shouldStop()) {
          this.logger.warn('Timeout approaching, stopping execution', {
            remaining: this.config.timeoutManager.getRemainingTimeMs(),
          });
          // Sentinel stays `running` — the next continuation invocation will
          // resolve it to `completed` or `failed`.
          return {
            status: 'needs_continuation',
            executionId,
            migrationsRun,
            migrationsRemaining: plan.slice(i).map((m) => m.id),
          };
        }

        await this.handleStaleMigration(migrationFile.id, direction);

        const startedAt = Date.now();

        const record = await this.config.storage.createRecord({
          id: migrationFile.id,
          name: migrationFile.name,
          status: 'running',
          direction,
          startedAt,
          executionId,
          description: migrationFile.migration.description,
        });

        this.logger.info(`Running ${direction}: ${migrationFile.id}`);

        const buffer = new OutputBuffer();
        const releaseCapture = attachOutputCapture(this.config.context, buffer);

        try {
          const fn = direction === 'up' ? migrationFile.migration.up : migrationFile.migration.down;
          const result = await fn(this.config.context);
          const completedAt = Date.now();
          const metadata = result ?? undefined;

          await this.config.storage.updateRecord(record.id, direction, executionId, {
            status: 'completed',
            completedAt,
            duration: completedAt - startedAt,
            metadata,
            output: buffer.isEmpty ? undefined : buffer.serialize(),
            outputTruncated: buffer.truncated ? true : undefined,
          });

          migrationsRun.push(migrationFile.id);
          this.logger.info(`Completed ${direction}: ${migrationFile.id}`, {
            duration: completedAt - startedAt,
          });
        } catch (error) {
          const completedAt = Date.now();
          const errorMessage = error instanceof Error ? error.message : String(error);

          await this.config.storage.updateRecord(record.id, direction, executionId, {
            status: 'failed',
            completedAt,
            duration: completedAt - startedAt,
            error: errorMessage,
            output: buffer.isEmpty ? undefined : buffer.serialize(),
            outputTruncated: buffer.truncated ? true : undefined,
          });

          this.logger.error(`Failed ${direction}: ${migrationFile.id}`, {
            error: errorMessage,
          });

          await this.upsertSentinel(
            executionId,
            direction,
            'failed',
            `Migration ${migrationFile.id} failed: ${errorMessage}`,
          );

          return {
            status: 'failed',
            executionId,
            migrationsRun,
            migrationsRemaining: plan.slice(i + 1).map((m) => m.id),
            error: `Migration ${migrationFile.id} failed: ${errorMessage}`,
          };
        } finally {
          releaseCapture();
        }
      }

      await this.upsertSentinel(executionId, direction, 'completed');
      return {
        status: 'completed',
        executionId,
        migrationsRun,
        migrationsRemaining: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Migration execution failed', { error: errorMessage });
      await this.upsertSentinel(executionId, direction, 'failed', errorMessage);
      return {
        status: 'failed',
        executionId,
        migrationsRun,
        migrationsRemaining: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Write (or overwrite) the dispatch sentinel record for an execution.
   *
   * The sentinel's `id` is `dispatch:<executionId>` and its primary-key
   * composite is `(id, direction, executionId)` — using ElectroDB's `put`
   * via `storage.createRecord` so successive writes during a single
   * execution land on the same key and overwrite in place.
   *
   * The sentinel is the source of truth for the overall outcome of an
   * execution as observed by `statusByExecution`. It's written:
   *
   * - At `execute()` entry as `running` (so `statusByExecution` finds
   *   something even if the runner crashes before completing any migration).
   * - On successful completion as `completed`.
   * - On any failure (per-migration or outer-catch) as `failed`, with the
   *   error captured.
   * - It can also be written by the task-stopped handler as `failed` when
   *   Fargate dies before the runner gets to write its own — see
   *   `handleTaskStoppedEvent`.
   */
  private async upsertSentinel(
    executionId: string,
    direction: MigrationDirection,
    status: 'running' | 'completed' | 'failed',
    error?: string,
  ): Promise<void> {
    try {
      const now = Date.now();
      await this.config.storage.createRecord({
        id: dispatchSentinelId(executionId),
        name: `Execution ${executionId}`,
        status,
        direction,
        startedAt: now,
        completedAt: status === 'running' ? undefined : now,
        executionId,
        error,
      });
    } catch (sentinelError) {
      // A sentinel write failure should never mask the underlying execution
      // outcome — log and swallow. The per-migration records remain the
      // ultimate ground truth even if the sentinel rollup is missing.
      const message =
        sentinelError instanceof Error ? sentinelError.message : String(sentinelError);
      this.logger.warn('Failed to write dispatch sentinel', {
        executionId,
        status,
        error: message,
      });
    }
  }

  private buildPlan(
    migrations: MigrationFile<TContext>[],
    completedSet: Set<string>,
    direction: MigrationDirection,
    target?: string,
  ): MigrationFile<TContext>[] {
    if (direction === 'up') {
      const pending = migrations.filter((m) => !completedSet.has(m.id));
      if (target) {
        const targetIndex = pending.findIndex((m) => m.id === target || m.name === target);
        if (targetIndex === -1) {
          throw new Error(`Target migration not found: ${target}`);
        }
        return pending.slice(0, targetIndex + 1);
      }
      return pending;
    }

    const completed = migrations.filter((m) => completedSet.has(m.id)).reverse();
    if (target) {
      const targetIndex = completed.findIndex((m) => m.id === target || m.name === target);
      if (targetIndex === -1) {
        throw new Error(`Target migration not found: ${target}`);
      }
      return completed.slice(0, targetIndex + 1);
    }
    return completed.slice(0, 1);
  }

  private async loadMigrationFiles(): Promise<MigrationFile<TContext>[]> {
    if (this.config.migrations) {
      return entriesToFiles(this.config.migrations);
    }
    return loadMigrations<TContext>(this.config.migrationsDir);
  }

  private async getCompletedMigrationIds(): Promise<Set<string>> {
    const records = await this.config.storage.getAllRecords();
    return getCompletedMigrationIds(records);
  }

  private async handleStaleMigration(id: string, direction: MigrationDirection): Promise<void> {
    const existing = await this.config.storage.getRecord(id, direction);
    if (existing?.status === 'running') {
      this.logger.warn(`Found stale running migration: ${id}, marking as failed`);
      await this.config.storage.updateRecord(id, existing.direction, existing.executionId, {
        status: 'failed',
        error: 'Marked as failed: found in running state during new execution',
        completedAt: Date.now(),
      });
    }
  }
}

function attachOutputCapture(context: MigrationContext, buffer: OutputBuffer): () => void {
  const prevLog = context.log;
  const prevLogger = context.logger;

  context.log = (message, ...rest) => {
    buffer.append('info', message, ...rest);
  };
  context.logger = {
    info: (message, data) => {
      buffer.append('info', message, ...(data === undefined ? [] : [data]));
    },
    warn: (message, data) => {
      buffer.append('warn', message, ...(data === undefined ? [] : [data]));
    },
    error: (message, data) => {
      buffer.append('error', message, ...(data === undefined ? [] : [data]));
    },
    debug: (message, data) => {
      buffer.append('debug', message, ...(data === undefined ? [] : [data]));
    },
  };

  // eslint-disable-next-line no-console
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  // eslint-disable-next-line no-console
  console.log = (...args: unknown[]) => {
    origLog(...args);
    buffer.append('info', args[0] ?? '', ...args.slice(1));
  };
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    buffer.append('warn', args[0] ?? '', ...args.slice(1));
  };
  console.error = (...args: unknown[]) => {
    origError(...args);
    buffer.append('error', args[0] ?? '', ...args.slice(1));
  };

  return () => {
    // eslint-disable-next-line no-console
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
    context.log = prevLog;
    context.logger = prevLogger;
  };
}

const MIGRATION_ID_REGEX = /^(\d{14})_(.+)$/;

function entriesToFiles<TContext extends MigrationContext>(
  entries: MigrationEntry<TContext>[],
): MigrationFile<TContext>[] {
  return entries.map((entry) => {
    const match = MIGRATION_ID_REGEX.exec(entry.id);
    const timestamp = match ? match[1] : entry.id;
    const name = match ? match[2] : entry.migration.name;

    return {
      id: entry.id,
      timestamp,
      name,
      filePath: '',
      migration: entry.migration,
    };
  });
}
