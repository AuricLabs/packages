import { MigrationRunner } from './migration-runner';

import type { ExecutionResult, MigrationContext, MigrationRunnerConfig } from '../types';

export interface FargateRunnerOptions<TContext extends MigrationContext = MigrationContext> {
  /** Provides the runner config. Called once at task startup. */
  createConfig: () => MigrationRunnerConfig<TContext> | Promise<MigrationRunnerConfig<TContext>>;
  /**
   * Override the direction. If omitted, reads `MIGRATION_DIRECTION` from env
   * (defaults to `up`). Set explicitly when embedding the runner outside the
   * standard Fargate Task entrypoint.
   */
  direction?: 'up' | 'down';
  /**
   * Override the target migration id. If omitted, reads `MIGRATION_TARGET`
   * from env (treats empty string as "no target").
   */
  target?: string;
  /**
   * Override the execution id. If omitted, reads `MIGRATION_EXECUTION_ID`
   * from env (set by the dispatcher Lambda via task overrides). If neither
   * is set (ad-hoc run), the runner generates one.
   *
   * Passing this through is what allows the dispatcher's returned
   * executionId to match the records the runner writes, so a polling
   * caller can scope via `statusByExecution(executionId)`.
   */
  executionId?: string;
}

/**
 * Run migrations to completion in a non-Lambda runtime (typically an ECS Fargate
 * Task). Unlike the Lambda handler, this runs the full plan in one shot with no
 * timeout manager — the host environment is expected to have no AWS-imposed
 * runtime cap.
 *
 * Returns the same `ExecutionResult` the runner produces inline. The caller is
 * responsible for translating a non-`completed` result into a non-zero process
 * exit so ECS / orchestrators can detect failure.
 */
export async function runMigrationsInFargate<TContext extends MigrationContext = MigrationContext>(
  options: FargateRunnerOptions<TContext>,
): Promise<ExecutionResult> {
  const config = await options.createConfig();

  const rawDirection: string = options.direction ?? process.env.MIGRATION_DIRECTION ?? 'up';
  if (rawDirection !== 'up' && rawDirection !== 'down') {
    throw new Error(`Invalid MIGRATION_DIRECTION: ${rawDirection}. Must be 'up' or 'down'.`);
  }
  const direction: 'up' | 'down' = rawDirection;

  const targetEnv = process.env.MIGRATION_TARGET;
  const target = options.target ?? (targetEnv && targetEnv.length > 0 ? targetEnv : undefined);

  const executionIdEnv = process.env.MIGRATION_EXECUTION_ID;
  const executionId =
    options.executionId ??
    (executionIdEnv && executionIdEnv.length > 0 ? executionIdEnv : undefined);
  const runOptions = executionId ? { executionId } : undefined;

  const runner = new MigrationRunner<TContext>(config);
  return direction === 'up' ? runner.up(target, runOptions) : runner.down(target, runOptions);
}

/**
 * Convenience wrapper for use as a Docker image `CMD`. Calls
 * `runMigrationsInFargate` and translates the result into a process exit code:
 * `completed` → 0; anything else → 1.
 */
export async function runMigrationsInFargateAsCli<
  TContext extends MigrationContext = MigrationContext,
>(options: FargateRunnerOptions<TContext>): Promise<never> {
  // CLI entrypoint — `process.exit` is the correct terminal action here.
  // ESLint's `n/no-process-exit` flags this for library code; this file is
  // explicitly the "run as a process" wrapper.
  /* eslint-disable n/no-process-exit */
  try {
    const result = await runMigrationsInFargate(options);
    if (result.status === 'completed') {
      process.exit(0);
    }

    console.error(
      `[migrations] run finished with status=${result.status}` +
        (result.error ? ` error=${result.error}` : ''),
    );
    process.exit(1);
  } catch (error) {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error(`[migrations] fatal error during fargate run: ${message}`);
    process.exit(1);
  }
  /* eslint-enable n/no-process-exit */
}
