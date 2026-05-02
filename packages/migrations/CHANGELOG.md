# @auriclabs/migrations

## 0.1.3

### Patch Changes

- 548021f: Fix `createDashboard({ auth })` throwing `ReferenceError: aws is not defined` at deploy
  time.

  The 0.1.x dashboard auth path called `new aws.cloudfront.Function(...)` relying on `aws` being a
  runtime global. SST only injects `aws` as a global into the user's compiled `sst.config.ts` — when
  this package's ESM bundle runs from `node_modules`, `aws` is `undefined`, so the very first deploy
  that set `auth` failed.

  Refactored the auth implementation to use SST's first-party
  `StaticSite.edge.viewerRequest.injection` escape hatch instead of attaching a separate
  `aws.cloudfront.Function` via `transform.cdn`. The basic-auth check is now spliced into the start
  of the StaticSite's existing CloudFront viewer-request function and returns a 401 before any
  routing logic runs. No new caller arguments — the `auth` option behaves the same way it was always
  documented to.

## 0.1.2

### Patch Changes

- c5b9b36: Fix `DynamoDBMigrationStorage` silently dropping `description`, `output`, and
  `outputTruncated`.

  The 0.1.0 release added these fields to the storage type, the runner, the ElectroDB schema, and
  the dashboard UI — but the marshaling layer in `DynamoDBMigrationStorage` (which translates
  between the typed `MigrationRecord` and the ElectroDB entity) was never updated to pass them
  through. The result: the runner captured descriptions and per-run output, the schema accepted
  them, but they never landed in DynamoDB, so the dashboard's expansion panels stayed empty even
  after a clean redeploy.

  `createRecord` now passes `description`, `output`, and `outputTruncated` to `entity.put()`;
  `updateRecord` includes the same three in its conditional `set()` body; `toMigrationRecord`
  returns them from the DDB row. Backfilled with regression tests so a future field addition doesn't
  hit the same gap.

## 0.1.1

### Patch Changes

- 63f70e5: Add HTTP basic auth on the dashboard and CLI commands for browsing run history.
  - **`createDashboard` accepts `auth?: BasicAuthConfig`** — when set, attaches a CloudFront
    viewer-request function to the static site that rejects requests without a matching
    `Authorization: Basic <base64>` header. Credentials are inlined into the function source at
    deploy time via Pulumi apply (so they live in CloudFront config, the same trust boundary as SST
    secret state). Note: this only gates the static UI — the API gateway URL stays directly
    callable, since browsers don't auto-send basic auth credentials cross-origin. Use it as
    discovery-prevention for the dashboard, not API protection.
  - **CLI: `auric-migrate executions [id]`** — lists recent execution batches with status,
    direction, migration count, started-time, and total duration. Pass an execution id to drill in
    (with `--detail` to expand each migration's description, result, output, and error). Useful in
    prod where the dashboard isn't deployed.
  - **CLI: `auric-migrate migration <id>`** — shows a migration's run history, with the latest run
    expanded by default (description, error, result, captured output). `--all` expands every run.
    Reuses the same record data the dashboard already displays.

  Both CLI commands take `-c, --config <path>` like the existing `up` / `down` / `status` commands
  and use the configured `MigrationStorage` directly — no extra infra needed.

## 0.1.0

### Minor Changes

- a4f7bd6: Add migration descriptions and per-run output capture.
  - **Descriptions** — Migrations can now declare an optional `description` (markdown). The runner
    snapshots it onto every migration record at run time, and the dashboard renders it as a card on
    the migration detail page.
  - **Output capture** — The runner injects `ctx.log(message, ...rest)` and a structured
    `ctx.logger` into the migration context, and tees `console.log/warn/error` for the duration of
    each run. Captured output is persisted on the record (200 KB cap with a tail-preserving ring
    buffer; `outputTruncated` set when older lines drop). Expandable rows on the dashboard now show
    the captured output, the structured `metadata` returned from `up`/`down` (with JSON syntax
    highlighting), and any error.

  Both additions are backwards compatible — old migrations without `description` and old records
  without `output` render as before. Migration list endpoints strip `output` to keep payloads small;
  the detail endpoint returns the full record.

## 0.0.6

### Patch Changes

- c13b1ee: Serve pre-built UI at deploy time instead of rebuilding from source. Eliminates the need
  for UI devDependencies in consumer workspaces.

## 0.0.5

### Patch Changes

- d73f72c: Bundle all runtime deps (electrodb, sst, commander, glob, uuid) into dist output and move
  to devDependencies. Replace MUI with Tailwind CSS + TanStack Table + Radix Dialog for a modern
  dark-mode dashboard UI. Zero runtime dependencies — only @aws-sdk peer deps remain.

## 0.0.4

### Patch Changes

- 525fd64: Add `nodejs` option to `createDashboard` to allow passing esbuild config (e.g. externals)
  to the dashboard Lambda function.

## 0.0.3

### Patch Changes

- 87de9ab: Pass `sst` as a parameter to `createTable` and `createDashboard` instead of referencing
  the global directly, fixing "sst is not defined" errors when the infra entry is imported from
  published packages.

## 0.0.2

### Patch Changes

- 1c5cf2a: Pass timeoutManager through migration context so long-running migrations can call
  `context.timeoutManager?.shouldStop()` to check if the Lambda is approaching its timeout.
