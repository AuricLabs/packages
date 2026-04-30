# @auriclabs/migrations

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
