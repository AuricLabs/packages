import { v4 as uuidv4 } from 'uuid';

import { getCompletedMigrationIds, getLatestRecordPerMigration } from '../utils/records';

import { loadMigrations } from './migration-loader';
import { OutputBuffer } from './output-buffer';

import type {
  ExecutionResult,
  MigrationContext,
  MigrationDirection,
  MigrationEntry,
  MigrationFile,
  MigrationLogger,
  MigrationRunnerConfig,
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

  async up(target?: string): Promise<ExecutionResult> {
    return this.execute('up', target);
  }

  async down(target?: string): Promise<ExecutionResult> {
    return this.execute('down', target);
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
      if (record.status === 'failed') {
        failed.push(id);
      }
    }

    return { pending, completed, failed };
  }

  private async execute(direction: MigrationDirection, target?: string): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const migrationsRun: string[] = [];

    try {
      const migrations = await this.loadMigrationFiles();
      const completedSet = await this.getCompletedMigrationIds();

      const plan = this.buildPlan(migrations, completedSet, direction, target);

      if (plan.length === 0) {
        this.logger.info(`No migrations to run (${direction})`);
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

      return {
        status: 'completed',
        executionId,
        migrationsRun,
        migrationsRemaining: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Migration execution failed', { error: errorMessage });
      return {
        status: 'failed',
        executionId,
        migrationsRun,
        migrationsRemaining: [],
        error: errorMessage,
      };
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
