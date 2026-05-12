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
 * Reserved id for the execution-level status row. Always written to this
 * fixed id (not `execution:<uuid>`) so ElectroDB's `put()` overwrites the
 * prior run's row on every task-stopped event. Without this, every failed
 * run leaves a permanent `failed` row in the table — `MigrationRunner.status()`
 * groups by id, so each unique `execution:<uuid>` accumulates forever and
 * poisons every subsequent `failed[]` check until manually cleaned up.
 */
export const EXECUTION_ROW_ID = 'execution:latest';

/**
 * Write an execution-level row capturing the Fargate task's exit outcome.
 * Always writes (success and failure) to a fixed id so `put()` overwrites
 * the prior run's row.
 *
 * - Success (`exitCode === 0`): status=`completed`. Doesn't surface in
 *   `failed[]`. Critically, this OVERWRITES any prior `failed` row left
 *   by a previous broken run — so a successful retry naturally clears
 *   the stale failure.
 * - Failure (`exitCode !== 0`): status=`failed`, with `stoppedReason` +
 *   `taskArn` captured for diagnostics. Surfaces in `failed[]` so the
 *   consumer's status poller exits within the next poll cycle.
 *
 * Idempotent under EventBridge redelivery: identical events produce
 * identical writes via `put()`.
 *
 * The row's `executionId` field is stamped with `latest` (not the real
 * runtime uuid) so the SK composite (`direction#executionId`) also
 * collapses to a deterministic value, ensuring overwrite. The real
 * runtime executionId is preserved on `name` and `metadata` for tracing.
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
    // (Other STOPPED events on the cluster — e.g. ad-hoc one-shot tasks —
    // would land here and should not write meta rows.)
    config.logger?.warn('ECS task-stopped event missing migration env overrides; ignoring', {
      taskArn,
    });
    return { status: 'ignored' };
  }

  const now = Date.now();
  const isSuccess = exitCode === 0;
  const error = isSuccess
    ? undefined
    : (stoppedReason ??
      (typeof exitCode === 'number'
        ? `Fargate task exited with code ${exitCode}`
        : 'Fargate task stopped without an exit code'));

  await config.storage.createRecord({
    id: EXECUTION_ROW_ID,
    name: `execution-${executionId}`,
    status: isSuccess ? 'completed' : 'failed',
    direction,
    startedAt: now,
    completedAt: now,
    // SK composite uses `executionId`; stamp it with the literal `latest`
    // so successive task-stopped events land on the same primary key and
    // `put()` overwrites in place. Real runtime executionId lives on `name`
    // + `metadata` for traceability.
    executionId: 'latest',
    error,
    taskArn,
    metadata: { runtimeExecutionId: executionId },
  });

  if (isSuccess) {
    config.logger?.info('Recorded Fargate task success on execution row', {
      executionId,
      direction,
      taskArn,
    });
    return { status: 'ignored' };
  }

  config.logger?.error('Recorded Fargate task failure on execution row', {
    executionId,
    direction,
    exitCode,
    stoppedReason,
    taskArn,
  });

  return { status: 'recorded' };
}
