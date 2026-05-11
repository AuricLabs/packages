---
'@auriclabs/migrations': minor
---

Fix `ERR_MODULE_NOT_FOUND` from the Fargate runner image and add EventBridge-driven dead-task detection.

**Bug 1 (runner image — also requires republishing `auriclabs/migrations-runner`):**

- `dockerfiles/runner/wrapper.mjs` — move `BUNDLE_PATH` from `/tmp/migrations-bundle.mjs` to `/app/migrations-bundle.mjs` so Node's ESM bare-specifier resolver walks `/app/node_modules` and finds the pre-installed AWS SDK clients. Previously, any bundle that imported `@aws-sdk/*` died with `ERR_MODULE_NOT_FOUND` before the first migration ran. (`NODE_PATH` does not apply to ESM resolution.)
- `dockerfiles/runner/runner-package.json` — pin `@smithy/*` and `@aws-crypto/*` explicitly so they don't version-float across image rebuilds.
- `dockerfiles/runner/Dockerfile` — add a resolver smoke step that writes a probe bundle at `/app/migrations-bundle.mjs` and imports every pinned AWS SDK client. Fails the image build instead of the first consumer deploy if drift creeps back in.
- `src/bundling/index.test.ts` — new parity assertion: every `DEFAULT_BUNDLE_EXTERNALS` glob must match at least one dep in `runner-package.json`.
- `CreateMigrationBundleOptions` — `external` and `esbuildOptions` are now typed publicly so consumers can opt into inlining without `@ts-expect-error` overrides.

**Bug 2 (framework — new EventBridge integration):**

- `createLambdaHandler` now detects AWS EventBridge `ECS Task State Change` events and, when a task transitions to `STOPPED` with a non-zero exit code AND no per-migration rows exist for its `MIGRATION_EXECUTION_ID`, writes an `execution:<uuid>` failed row capturing the `stoppedReason` and `taskArn`. `MigrationRunner.status()` surfaces it in `failed[]` via the existing path. Consumers polling status (e.g. CI) fail loudly within seconds instead of hanging on `pending=N` until the Lambda budget expires.
- New `attachTaskStoppedRule(...)` helper wires the EventBridge rule + target + Lambda permission. Call it after `createFargateRunner` and the dispatcher Lambda are constructed.
- `MigrationRecord` gains an optional `taskArn` field (purely for traceability — execution meta-rows record the ARN that died).
- New `TaskStoppedResult` type and `task-stopped` action exported from `runner-types`.

No breaking changes — existing consumers see no behaviour difference until they call `attachTaskStoppedRule(...)`. Update your `infra/migrations.ts` (or equivalent) and bump your runner image digest pin to the next `auriclabs/migrations-runner` publish.
