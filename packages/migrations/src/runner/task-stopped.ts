import type {
  MigrationContext,
  MigrationDirection,
  MigrationRunnerConfig,
  TaskStoppedResult,
} from '../types';

/**
 * Subset of the AWS EventBridge `ECS Task State Change` event we care about.
 * Routed to the dispatcher Lambda by the rule `createFargateRunner` attaches
 * when a task transitions to `STOPPED` in the migration cluster. The bundle
 * sets `MIGRATION_EXECUTION_ID` + `MIGRATION_DIRECTION` via task overrides
 * (passed through SST's `task.run()` env), and EventBridge echoes the
 * container overrides verbatim — no `DescribeTasks` call needed.
 *
 * Spec: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_cwe_events.html
 */
export interface TaskStateChangeEvent {
  source: 'aws.ecs';
  'detail-type': 'ECS Task State Change';
  detail: {
    taskArn?: string;
    lastStatus?: string;
    stoppedReason?: string;
    containers?: { exitCode?: number }[];
    overrides?: {
      containerOverrides?: {
        environment?: { name: string; value: string }[];
      }[];
    };
  };
}

export function isTaskStateChangeEvent(event: unknown): event is TaskStateChangeEvent {
  if (typeof event !== 'object' || event === null) return false;
  const e = event as Record<string, unknown>;
  return e.source === 'aws.ecs' && e['detail-type'] === 'ECS Task State Change';
}

interface ParsedTaskStopped {
  taskArn: string | undefined;
  lastStatus: string | undefined;
  stoppedReason: string | undefined;
  exitCode: number | undefined;
  executionId: string | undefined;
  direction: MigrationDirection | undefined;
}

export function parseTaskStoppedEvent(event: TaskStateChangeEvent): ParsedTaskStopped {
  const detail = event.detail;
  // First container is the essential one for the runner image — its exit
  // code is what ECS uses for the task-level lifecycle.
  const exitCode = detail.containers?.[0]?.exitCode;

  let executionId: string | undefined;
  let direction: MigrationDirection | undefined;
  for (const co of detail.overrides?.containerOverrides ?? []) {
    for (const env of co.environment ?? []) {
      if (env.name === 'MIGRATION_EXECUTION_ID') executionId = env.value;
      if (env.name === 'MIGRATION_DIRECTION' && (env.value === 'up' || env.value === 'down')) {
        direction = env.value;
      }
    }
  }

  return {
    taskArn: detail.taskArn,
    lastStatus: detail.lastStatus,
    stoppedReason: detail.stoppedReason,
    exitCode,
    executionId,
    direction,
  };
}

/**
 * @deprecated Pre-0.4.4 task-stopped handler wrote rows to this fixed id
 * (`execution:latest`) to collapse the SK composite and let `put()`
 * overwrite the prior run's row. That design is last-writer-wins across
 * concurrent or retried runs — a failed task followed by a successful
 * retry could leave the row in either state depending on event ordering,
 * making the polling consumer's exit code unreliable.
 *
 * 0.4.4+ stops writing this row entirely and instead transitions a per-run
 * `dispatch:<executionId>` sentinel via {@link MigrationRunner.statusByExecution}.
 * The export is preserved so external code that imports it still compiles,
 * and {@link MigrationRunner.status} keeps filtering rows with this id out
 * of `failed[]` for backwards compat with existing tables. Do not write
 * new rows with this id.
 */
export const EXECUTION_ROW_ID = 'execution:latest';

/** Prefix used for per-execution dispatch sentinel rows. */
const DISPATCH_SENTINEL_PREFIX = 'dispatch:';

/** Build the canonical sentinel id for a given executionId. */
export function dispatchSentinelId(executionId: string): string {
  return `${DISPATCH_SENTINEL_PREFIX}${executionId}`;
}

/**
 * True if `id` is a dispatch sentinel row (any executionId). Used by
 * `MigrationRunner.status` to filter sentinels out of the global
 * `failed[]` rollup — sentinels are per-run state and should only surface
 * via `statusByExecution`.
 */
export function isDispatchSentinelId(id: string): boolean {
  return id.startsWith(DISPATCH_SENTINEL_PREFIX);
}

/**
 * Handle an EventBridge `ECS Task State Change` event where `lastStatus`
 * is `STOPPED`. Two failure modes need to be papered over:
 *
 * 1. **Runner ran but a migration failed.** The runner already wrote a
 *    per-migration `failed` row and transitioned its dispatch sentinel
 *    to `failed`. We don't need to do anything — the records reflect
 *    reality. We still walk records to mark any stray `running` rows
 *    failed (defence against the runner crashing between writing a
 *    `running` row and writing its terminal write).
 * 2. **Fargate died before the runner could write.** No per-migration
 *    rows exist; no sentinel exists. We create the sentinel as `failed`
 *    so `statusByExecution(executionId)` can return a definitive failure
 *    to a polling caller instead of `not_found` forever.
 *
 * On clean exit (`exitCode === 0`), the runner already transitioned the
 * sentinel to `completed` and wrote terminal per-migration rows; we still
 * sweep for any stray `running` row (would indicate a runner bug, but
 * worth defending against). No `execution:latest` row is written — that
 * pattern is removed (see {@link EXECUTION_ROW_ID}).
 */
export async function handleTaskStoppedEvent<TContext extends MigrationContext>(
  event: TaskStateChangeEvent,
  config: MigrationRunnerConfig<TContext>,
): Promise<TaskStoppedResult> {
  const { taskArn, lastStatus, stoppedReason, exitCode, executionId, direction } =
    parseTaskStoppedEvent(event);

  if (lastStatus !== 'STOPPED') {
    return { status: 'ignored' };
  }

  if (!executionId || !direction) {
    // Task wasn't dispatched by us — no MIGRATION_EXECUTION_ID in overrides.
    config.logger?.warn('ECS task-stopped event missing migration env overrides; ignoring', {
      taskArn,
    });
    return { status: 'ignored' };
  }

  const isSuccess = exitCode === 0;
  const errorMessage = isSuccess
    ? undefined
    : (stoppedReason ??
      (typeof exitCode === 'number'
        ? `Fargate task exited with code ${exitCode}`
        : 'Fargate task stopped without an exit code'));

  // Pull every record written under this executionId. The dispatch sentinel
  // and every per-migration row share the same executionId, so this is the
  // single query that drives all reconciliation below.
  const records = await config.storage.getRecordsByExecutionId(executionId);
  const sentinelId = dispatchSentinelId(executionId);
  const sentinel = records.find((r) => r.id === sentinelId);
  const stillRunning = records.filter((r) => r.id !== sentinelId && r.status === 'running');

  const now = Date.now();
  let recorded = false;

  // (1) Mark any per-migration rows that are still `running`. The runner
  // writes terminal rows itself; this is purely defence-in-depth for the
  // "Fargate died mid-migration" case.
  for (const stale of stillRunning) {
    try {
      await config.storage.updateRecord(stale.id, stale.direction, stale.executionId, {
        status: 'failed',
        completedAt: now,
        error: errorMessage ?? 'Fargate task stopped while migration was still running',
      });
      recorded = true;
    } catch (err) {
      config.logger?.warn('Failed to mark stale running migration row failed on task-stopped', {
        executionId,
        recordId: stale.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // (2) If the task failed and the sentinel doesn't exist (or is still
  // running), force it to `failed`. This is the path that closes the loop
  // for callers polling `statusByExecution` when Fargate crashed at boot.
  // On clean exit we leave the sentinel alone — the runner already wrote
  // its terminal state.
  if (!isSuccess) {
    const sentinelNeedsClose = !sentinel || sentinel.status === 'running';
    if (sentinelNeedsClose) {
      try {
        await config.storage.createRecord({
          id: sentinelId,
          name: `Execution ${executionId}`,
          status: 'failed',
          direction,
          startedAt: sentinel?.startedAt ?? now,
          completedAt: now,
          executionId,
          error: errorMessage,
          taskArn,
          metadata: { runtimeExecutionId: executionId, stoppedReason, exitCode },
        });
        recorded = true;
      } catch (err) {
        config.logger?.warn('Failed to write/refresh dispatch sentinel on task-stopped', {
          executionId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    config.logger?.error('Fargate task stopped with failure', {
      executionId,
      direction,
      exitCode,
      stoppedReason,
      taskArn,
    });
  } else if (sentinel && sentinel.status === 'running') {
    // Edge case: Fargate exited 0 but the runner never wrote a terminal
    // sentinel (e.g. the process was killed *after* migrations completed
    // but before the sentinel update flushed). Close it as completed so
    // polling consumers don't hang.
    try {
      await config.storage.createRecord({
        id: sentinelId,
        name: `Execution ${executionId}`,
        status: 'completed',
        direction,
        startedAt: sentinel.startedAt,
        completedAt: now,
        executionId,
        taskArn,
        metadata: { runtimeExecutionId: executionId, exitCode },
      });
      recorded = true;
    } catch (err) {
      config.logger?.warn('Failed to close dispatch sentinel on clean task-stopped', {
        executionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    config.logger?.info('Fargate task stopped cleanly; closed stale running sentinel', {
      executionId,
      taskArn,
    });
  } else {
    config.logger?.info('Fargate task stopped cleanly', { executionId, taskArn });
  }

  return { status: recorded ? 'recorded' : 'ignored' };
}
