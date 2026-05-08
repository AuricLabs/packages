---
"@auriclabs/migrations": minor
---

Add ECS Fargate runtime path so a single migration can exceed Lambda's 15-minute hard cap. Three new exports:

- `runMigrationsInFargate(options)` / `runMigrationsInFargateAsCli(options)` — runtime entrypoints for use inside an ECS Fargate Task. Run the planned migrations to completion with no `timeoutManager` (no AWS-imposed timeout). The CLI variant translates a non-`completed` result into `process.exit(1)` so ECS marks the Task as failed.
- `LambdaHandlerOptions.dispatchTo` — when set, `createLambdaHandler` becomes a thin **dispatcher**: it computes pending migrations via `runner.status()` and either returns `{ status: 'no_work', … }` (no pending and direction is `up`) or fires `dispatchTo({ direction, target, executionId })` and returns `{ status: 'dispatched', executionId, … }`. The `action: 'status'` path stays inline regardless so the dashboard's `getStatus` keeps working. Inline-execution behaviour is preserved when `dispatchTo` is omitted — no breaking change for existing consumers.
- `createFargateRunner({ sst, image, link, environment, vpc?, cluster?, cpu?, memory?, architecture? })` (from `@auriclabs/migrations/infra`) — provisions an `sst.aws.Vpc` (NAT-disabled by default), `sst.aws.Cluster`, and one-shot `sst.aws.Task`. Returns `{ vpc, cluster, task }` so the consumer can `link` the Task into their dispatcher Lambda.

The Fargate path uses the existing `MigrationRunner` and `DynamoDBMigrationStorage`, so the migration record schema (`pending → running → completed|failed`), `OutputBuffer` capture, and dashboard visibility all keep working identically. No `MigrationStatus` enum change.
