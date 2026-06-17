# @auriclabs/logger

## 0.1.2

### Patch Changes

- dc287d0: Move `@auriclabs/env`, `axios`, and `pino-lambda` from `peerDependencies` to
  `dependencies`. The package's entry module (`dist/index.mjs`) imports all three unconditionally at
  the top level (env in `logger`/`resolve-log-level`/`create-streams`, `pino-lambda` in
  `create-streams`, `axios` in the transports and serializer hooks), so they are true runtime
  dependencies, not host-provided peers. As peers they were not installed for standalone consumers
  (e.g. `@alfe.ai/openclaw` installed into a fresh `node_modules`), causing
  `Cannot find package '@auriclabs/env'` at plugin load.

  `sst` remains a `peerDependency` (it is not imported at runtime). `zod` is **not** affected here —
  it is a peer of `@auriclabs/env` by design (env accepts consumer-supplied zod schemas and relies
  on a single shared zod instance), so it must be satisfied by the composition root, not bundled.

## 0.1.1

### Patch Changes

- eeb513b: Upgrade tsdown to 0.21.4 and update package exports to use `.mjs`/`.d.mts` extensions.
- Updated dependencies [eeb513b]
  - @auriclabs/env@0.0.4

## 0.1.0

### Minor Changes

- bf60a1f: Upgrade SST from v3 to v4. Updated Pulumi AWS provider from v6 to v7, regenerated
  platform type declarations, removed aws-native provider dependency, and added new SST v4 globals
  to ESLint config.

## 0.0.9

### Patch Changes

- 99c3898: Added safe JSON stringification for local logging

## 0.0.8

### Patch Changes

- cc81ac4: Added 0 log level for lambda destination

## 0.0.7

### Patch Changes

- 2c1a67c: Fixed issues for browser

## 0.0.6

### Patch Changes

- a619a3b: Made the streams also available on web

## 0.0.5

### Patch Changes

- 6680378: Added component level categorising

## 0.0.4

### Patch Changes

- ef69a0a: Update lodash to lodash-es

## 0.0.3

### Patch Changes

- 7ae5da8: Fix for module export ordering

## 0.0.2

### Patch Changes

- 732042e: Bump esm module exports
- Updated dependencies [732042e]
  - @auriclabs/env@0.0.3
