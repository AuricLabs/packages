import type { MigrationContext, MigrationEntry } from './migration.types';
import type { MigrationStorage } from './storage.types';
import type { TimeoutManager } from './timeout.types';

export type { TimeoutManager };

export interface MigrationLogger {
  info: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
}

interface MigrationRunnerBaseConfig<TContext extends MigrationContext = MigrationContext> {
  storage: MigrationStorage;
  context: TContext;
  logger?: MigrationLogger;
  timeoutManager?: TimeoutManager;
}

/**
 * Configuration for MigrationRunner.
 *
 * Provide **one** of:
 * - `migrationsDir` — path to a directory of migration files (uses glob + dynamic import at runtime).
 *   Best for CLI and local Node processes.
 * - `migrations` — an array of pre-imported migration entries (bundler-friendly).
 *   Best for Lambda deployments where dynamic imports aren't bundled. Use `defineMigrations()` to create this array.
 */
export type MigrationRunnerConfig<TContext extends MigrationContext = MigrationContext> =
  MigrationRunnerBaseConfig<TContext> &
    (
      | { migrationsDir: string; migrations?: never }
      | { migrationsDir?: never; migrations: MigrationEntry<TContext>[] }
    );

export interface ExecutionResult {
  status: 'completed' | 'needs_continuation' | 'failed';
  executionId: string;
  migrationsRun: string[];
  migrationsRemaining: string[];
  error?: string;
}

export interface LambdaHandlerOptions<TContext extends MigrationContext = MigrationContext> {
  /** Override the function name used for self-continuation. If omitted, reads from the Lambda context. */
  functionName?: string;
  createConfig: () => MigrationRunnerConfig<TContext> | Promise<MigrationRunnerConfig<TContext>>;
  timeoutThresholdMs?: number;
  /** Maximum continuation depth before failing. Defaults to 100. */
  maxContinuationDepth?: number;
}
