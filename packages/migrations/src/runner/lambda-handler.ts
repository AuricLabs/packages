import { v4 as uuidv4 } from 'uuid';

import { invokeLambdaAsync } from '../utils/lambda';

import { MigrationRunner } from './migration-runner';
import { handleTaskStoppedEvent, isTaskStateChangeEvent } from './task-stopped';
import { createLambdaTimeoutManager } from './timeout-manager';

import type {
  DispatchResult,
  ExecutionResult,
  ExecutionStatus,
  LambdaHandlerOptions,
  MigrationContext,
  TaskStoppedResult,
} from '../types';
import type { Context } from 'aws-lambda';

export interface StatusResult {
  pending: string[];
  completed: string[];
  failed: string[];
}

const DEFAULT_MAX_DEPTH = 100;

export function createLambdaHandler<TContext extends MigrationContext>(
  options: LambdaHandlerOptions<TContext>,
) {
  return async (
    event: Record<string, unknown>,
    context: Context,
  ): Promise<
    ExecutionResult | StatusResult | DispatchResult | TaskStoppedResult | ExecutionStatus
  > => {
    // EventBridge `ECS Task State Change` events arrive here when
    // `createFargateRunner` wired the dispatcher Lambda as the rule target.
    // Detect and dispatch before any direction/action parsing — the event
    // shape has no `action` field.
    if (isTaskStateChangeEvent(event)) {
      const config = await options.createConfig();
      return handleTaskStoppedEvent(event, config);
    }

    const action = event.action as string | undefined;

    const config = await options.createConfig();

    // Handle status action — synchronous, no timeout manager / dispatcher needed.
    // The dashboard's `getStatus` calls this via `invokeLambdaSync` and must
    // always return inline regardless of `dispatchTo`.
    if (action === 'status') {
      const runner = new MigrationRunner<TContext>(config);
      return runner.status();
    }

    // Handle statusByExecution — scoped polling by a single executionId.
    // CI's `scripts/run-migrations.ts` polls this to detect whether the run
    // *it* dispatched completed, ignoring any other historical/concurrent
    // executions writing to the same table. Always inline.
    if (action === 'statusByExecution') {
      const targetExecutionId = event.executionId;
      if (typeof targetExecutionId !== 'string' || targetExecutionId.length === 0) {
        return {
          executionId: '',
          status: 'not_found',
          migrations: [],
          error: 'statusByExecution requires a non-empty `executionId` field on the event',
        };
      }
      const runner = new MigrationRunner<TContext>(config);
      return runner.statusByExecution(targetExecutionId);
    }

    const direction = (event.direction as string | undefined) ?? 'up';
    if (direction !== 'up' && direction !== 'down') {
      return {
        status: 'failed',
        executionId: '',
        migrationsRun: [],
        migrationsRemaining: [],
        error: `Invalid direction: ${direction}. Must be 'up' or 'down'.`,
      };
    }

    const target = event.target as string | undefined;
    if (target !== undefined && typeof target !== 'string') {
      return {
        status: 'failed',
        executionId: '',
        migrationsRun: [],
        migrationsRemaining: [],
        error: 'Invalid target: must be a string.',
      };
    }

    // --- Dispatcher mode -----------------------------------------------------
    // When `dispatchTo` is provided, this Lambda is the entrypoint but **not**
    // the runtime. Compute pending work and either no-op (no_work) or fire the
    // external runtime (dispatched) and return immediately. No timeout manager,
    // no continuation, no inline execution.
    if (options.dispatchTo) {
      const runner = new MigrationRunner<TContext>(config);
      const status = await runner.status();

      // `up` with nothing pending is the common case on no-op deploys.
      // Skip dispatch entirely so e.g. CI deploy steps stay fast (~2s).
      if (direction === 'up' && status.pending.length === 0) {
        config.logger?.info('No pending migrations, skipping dispatch');
        return {
          status: 'no_work',
          pending: status.pending,
          failed: status.failed,
        };
      }

      const executionId = uuidv4();
      config.logger?.info('Dispatching migration run to external runtime', {
        direction,
        target,
        executionId,
        pending: status.pending,
      });

      // Write the dispatch sentinel as `running` BEFORE calling dispatchTo
      // (which is typically `ecs.RunTask`). This guarantees that even if the
      // Fargate task dies before its bundle imports — i.e. the runner never
      // gets to write any record itself — a polling caller calling
      // `statusByExecution(executionId)` finds the sentinel and can observe
      // the run transition to `failed` via the task-stopped handler. The
      // runner's own `execute()` will idempotently re-`put` the same id once
      // it starts, so no race.
      try {
        const sentinelNow = Date.now();
        await config.storage.createRecord({
          id: `dispatch:${executionId}`,
          name: `Execution ${executionId}`,
          status: 'running',
          direction,
          startedAt: sentinelNow,
          executionId,
        });
      } catch (err) {
        config.logger?.warn('Failed to write dispatch sentinel before task.run', {
          executionId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      await options.dispatchTo({ direction, target, executionId });

      return {
        status: 'dispatched',
        executionId,
        pending: status.pending,
      };
    }

    // --- Inline (Lambda-runtime) mode ---------------------------------------
    // Original behaviour: run migrations directly in this Lambda invocation,
    // checkpointing between migrations and self-reinvoking when remaining time
    // drops below `timeoutThresholdMs`.
    const depth = typeof event.depth === 'number' ? event.depth : 0;
    const maxDepth = options.maxContinuationDepth ?? DEFAULT_MAX_DEPTH;
    if (depth >= maxDepth) {
      return {
        status: 'failed',
        executionId: '',
        migrationsRun: [],
        migrationsRemaining: [],
        error: `Continuation depth limit exceeded (${maxDepth}). Possible infinite loop.`,
      };
    }

    const functionName = options.functionName ?? context.functionName;

    const timeoutManager = createLambdaTimeoutManager(
      () => context.getRemainingTimeInMillis(),
      options.timeoutThresholdMs,
    );

    const runner = new MigrationRunner<TContext>({
      ...config,
      context: { ...config.context, timeoutManager },
      timeoutManager,
    });

    const result = direction === 'up' ? await runner.up(target) : await runner.down(target);

    if (result.status === 'needs_continuation') {
      config.logger?.info('Re-invoking Lambda for continuation', {
        executionId: result.executionId,
        migrationsRemaining: result.migrationsRemaining,
      });

      await invokeLambdaAsync(functionName, { direction, target, depth: depth + 1 });
    }

    return result;
  };
}
