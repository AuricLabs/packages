import { invokeLambdaAsync } from '../utils/lambda';

import { MigrationRunner } from './migration-runner';
import { createLambdaTimeoutManager } from './timeout-manager';

import type { ExecutionResult, LambdaHandlerOptions, MigrationContext } from '../types';
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
  ): Promise<ExecutionResult | StatusResult> => {
    const action = event.action as string | undefined;

    const config = await options.createConfig();

    // Handle status action — synchronous, no timeout manager needed
    if (action === 'status') {
      const runner = new MigrationRunner<TContext>(config);
      return runner.status();
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
