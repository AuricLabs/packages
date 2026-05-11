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
 * Write an execution-level `failed` row when an ECS task stopped abnormally
 * before its bundle could record per-migration rows of its own (e.g. the
 * bundle crashed at module-import time before `MigrationRunner.execute()`
 * even ran). `MigrationRunner.status()` picks the row up via the standard
 * `getAllRecords()` pass and surfaces it in `failed[]` — the consumer's
 * status poller exits with the recorded `stoppedReason` instead of hanging
 * indefinitely waiting for migration records that will never arrive.
 *
 * Idempotent: if the bundle DID manage to write any per-execution rows
 * (success or failure), this is a no-op — those rows are authoritative.
 * If the row already exists (event redelivery), this is also a no-op.
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

  if (exitCode === 0) {
    // Clean exit — the runner's MigrationRunner wrote per-migration rows
    // for everything it ran. No execution-level meta row needed.
    return { status: 'ignored' };
  }

  // If the bundle wrote ANY row for this execution (success or failure of
  // individual migrations), trust those. The meta row is only for the case
  // where the task died before MigrationRunner.execute() got far enough to
  // write a single record.
  const existing = await config.storage.getRecordsByExecutionId(executionId);
  if (existing.length > 0) {
    config.logger?.info(
      'ECS task stopped abnormally after bundle wrote rows; skipping execution meta-row',
      { executionId, recordCount: existing.length, taskArn, exitCode, stoppedReason },
    );
    return { status: 'ignored' };
  }

  const now = Date.now();
  const id = `execution:${executionId}`;
  const error =
    stoppedReason ??
    (typeof exitCode === 'number'
      ? `Fargate task exited with code ${exitCode}`
      : 'Fargate task stopped without an exit code');

  await config.storage.createRecord({
    id,
    name: `execution-${executionId}`,
    status: 'failed',
    direction,
    startedAt: now,
    completedAt: now,
    executionId,
    error,
    taskArn,
  });

  config.logger?.error('Recorded Fargate task failure as execution-level row', {
    executionId,
    direction,
    exitCode,
    stoppedReason,
    taskArn,
  });

  return { status: 'recorded' };
}
