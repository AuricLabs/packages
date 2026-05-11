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

/**
 * Payload handed to a `dispatchTo` callback when the Lambda handler is acting
 * as a dispatcher rather than running migrations inline.
 */
export interface DispatchPayload {
  direction: 'up' | 'down';
  target?: string;
  executionId: string;
}

/**
 * Returned by the Lambda handler when running in dispatcher mode.
 * - `no_work` — direction was `up` and there were no pending migrations; nothing was dispatched.
 * - `dispatched` — work was handed off to the external runtime. The caller should poll
 *   the migration storage for `running → completed|failed` records to track progress.
 */
export type DispatchResult =
  | { status: 'no_work'; pending: string[]; failed: string[] }
  | { status: 'dispatched'; executionId: string; pending: string[] };

/**
 * Returned by the Lambda handler when invoked with an EventBridge
 * `ECS Task State Change` payload (the `task-stopped` path used by
 * `createFargateRunner`'s rule).
 *
 * - `recorded` — wrote an `execution:<uuid>` failed row because the
 *   Fargate task stopped before its bundle could write any per-migration
 *   row of its own (e.g. crashed at module-import time).
 * - `ignored` — task exited cleanly, was unrelated to a migration run, or
 *   the bundle already wrote rows for that execution so a meta row would
 *   be redundant noise.
 */
export interface TaskStoppedResult {
  status: 'recorded' | 'ignored';
}

export interface LambdaHandlerOptions<TContext extends MigrationContext = MigrationContext> {
  /** Override the function name used for self-continuation. If omitted, reads from the Lambda context. */
  functionName?: string;
  createConfig: () => MigrationRunnerConfig<TContext> | Promise<MigrationRunnerConfig<TContext>>;
  timeoutThresholdMs?: number;
  /** Maximum continuation depth before failing. Defaults to 100. */
  maxContinuationDepth?: number;
  /**
   * When provided, the Lambda becomes a thin **dispatcher** instead of running migrations
   * inline. On invoke it calls `runner.status()` to compute pending work; if any is found
   * (or `direction === 'down'`), it forwards the request to `dispatchTo` (typically an
   * `ecs:RunTask` or similar) and returns immediately. This unblocks single-migration
   * runs that exceed Lambda's 15-minute hard cap by pushing execution to a runtime
   * with no AWS-imposed timeout.
   *
   * The `action: 'status'` path stays inline regardless — status is a fast read.
   */
  dispatchTo?: (payload: DispatchPayload) => Promise<void>;
}
