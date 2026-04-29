# @auriclabs/migrations

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
