---
'@auriclabs/migrations': patch
---

Fix stale `execution:<uuid>` rows poisoning `status().failed[]` forever.

Versions `0.4.0`-`0.4.2` wrote execution-level rows with the runtime
executionId in the id (`execution:<uuid>`), so ElectroDB's `put()` never
overwrote prior runs — every failed Fargate task left a permanent
`failed` row in `MigrationsTable`. `MigrationRunner.status()` groups by
id, so each stale row surfaced as a separate failure forever, breaking
every subsequent CI deploy until someone manually cleaned the table.

Fix:

1. `task-stopped` handler now writes to a fixed id `execution:latest`
   (exported as `EXECUTION_ROW_ID`) and stamps the SK composite's
   `executionId` field with the literal `'latest'` so the primary key
   composite collapses to a deterministic value. `put()` overwrites in
   place. The real runtime executionId is preserved on `name` and
   `metadata.runtimeExecutionId` for tracing.
2. On clean exit (`exitCode === 0`), the handler now ALSO writes
   `execution:latest` with `status: 'completed'` — overwriting any
   `failed` row from a prior broken run. Successful retries are
   self-healing; no operator intervention needed.
3. `MigrationRunner.status()` filters out any `execution:<other-id>`
   rows from `failed[]` — only `execution:latest` is considered. This
   makes the upgrade zero-touch for consumers with pre-existing stale
   `execution:<uuid>` rows from earlier versions.

Maintainer action required after merge: push a `migrations-runner-v*`
tag to republish the Docker image if there are any image-side changes;
this patch is npm-side only.
