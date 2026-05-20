---
"@auriclabs/migrations": patch
---

Plumb `executionId` end-to-end (dispatcher → runner) and add a scoped-poll API
so callers can observe a single run's outcome without contention from
concurrent or historical runs.

**New public surface (additive):**

- `MigrationRunner.up(target?, options?: { executionId? })` — accepts a
  caller-supplied executionId. Same for `.down()` and `.execute()`.
- `MigrationRunner.statusByExecution(executionId)` — returns
  `ExecutionStatus { executionId, status: 'running' | 'completed' | 'failed' | 'not_found', migrations, error? }`.
  Use this from polling consumers (CI, dashboard) instead of `status()` when
  you want state for a specific run.
- `runMigrationsInFargate({ executionId? })` — and reads
  `MIGRATION_EXECUTION_ID` from env when no option is supplied.
- `createLambdaHandler` accepts `{ action: 'statusByExecution', executionId }`.
- Exported helpers `dispatchSentinelId(executionId)` and `isDispatchSentinelId(id)`.

**Behavior changes:**

- The dispatcher Lambda now forwards the executionId it returns to the caller
  through to the Fargate task (via task overrides), so the records the runner
  writes share the same id. Previously, the dispatcher returned one UUID and
  the runner generated its own — making `statusByExecution`-style polling
  impossible.
- The runner writes a `dispatch:<executionId>` sentinel row at execution
  start (`running`) and transitions it on terminal outcomes
  (`completed` | `failed`). This is the source of truth for the overall
  status of a run.
- The dispatcher writes the same sentinel as `running` BEFORE calling
  `dispatchTo` so a polling caller finds the row even if Fargate crashes
  before the runner imports.
- The ECS `task-stopped` handler no longer writes the `execution:latest`
  singleton row. Instead it:
  - Marks any per-migration rows still `running` as `failed`.
  - If the sentinel is missing or still `running` and the task failed,
    transitions the sentinel to `failed` so callers can observe it.
  - On clean exit, leaves the sentinel alone (the runner wrote its terminal
    state already).

**Backwards compatibility:**

- `EXECUTION_ROW_ID` (`'execution:latest'`) is preserved as a
  `@deprecated` export. No new rows are written with this id, but
  `MigrationRunner.status()` still filters historical `execution:*` rows out
  of `failed[]` so existing tables don't need to be cleaned.
- `MigrationRunner.status()` additionally filters `dispatch:<uuid>` sentinels
  out of `failed[]` — per-run state belongs in `statusByExecution`.
- Existing callers that don't pass `options.executionId` keep working
  unchanged; a UUID is generated as before.

**Why `patch`, not `minor`:** the API additions are purely additive; the
removal of `execution:latest` writes is an observable behavior change but
that row was an internal coordination artifact (not part of the documented
API surface) and existing tables continue to work because `status()` still
filters those rows. Consumers should migrate to `statusByExecution` for
reliable per-run polling; the legacy `status()` path is preserved for the
dashboard's global rollup view.

**Caller migration (recommended):** scripts that poll for a specific
dispatched run should switch from `action: 'status'` to
`action: 'statusByExecution'` with the `executionId` returned by the
dispatcher. The legacy path keeps working for the global dashboard view.
