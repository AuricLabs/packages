# @auriclabs/sst-utils

## 1.1.1

### Patch Changes

- 711cf47: Fix CORS preflight failures in consolidated mode by registering individual method+path
  routes instead of `ANY /{proxy+}` catch-all. The catch-all intercepted OPTIONS requests, bypassing
  API Gateway's native CORS handling and causing 401 responses on preflight.

## 1.1.0

### Minor Changes

- 3d3f935: Add `consolidate` option to `registerApiRoutes` that groups routes by function config
  into shared Lambdas via `@middy/http-router`, reducing cold starts and API Gateway integration
  count.

## 1.0.1

### Patch Changes

- eeb513b: Fix ReferenceError when `aws` global is accessed from node_modules. The `aws` identifier
  is only available at the type level via SST's `export import` declaration and is not set on
  `globalThis` at runtime. Removed hardcoded `aws` from constructProperties calls — consumers should
  pass it through the `variables` option instead.
- 1c34bf8: Fix route path extraction for root-level handler files (e.g. `get.ts`, `post.ts` at the
  top of the routesDir). The regex now makes the leading `/` optional so root-level method files
  resolve to the prefix path correctly instead of producing routes like `GET /agents/get`.
- Updated dependencies [eeb513b]
  - @auriclabs/logger@0.1.1

## 1.0.0

### Minor Changes

- bf60a1f: Upgrade SST from v3 to v4. Updated Pulumi AWS provider from v6 to v7, regenerated
  platform type declarations, removed aws-native provider dependency, and added new SST v4 globals
  to ESLint config.

### Patch Changes

- Updated dependencies [bf60a1f]
  - @auriclabs/sst-types@0.1.0
  - @auriclabs/logger@0.1.0

## 0.0.13

### Patch Changes

- Updated dependencies [99c3898]
  - @auriclabs/logger@0.0.9

## 0.0.12

### Patch Changes

- Updated dependencies [cc81ac4]
  - @auriclabs/logger@0.0.8

## 0.0.11

### Patch Changes

- 549b3a9: Added typing overloads to require-env

## 0.0.10

### Patch Changes

- Updated dependencies [2c1a67c]
  - @auriclabs/logger@0.0.7

## 0.0.9

### Patch Changes

- Updated dependencies [a619a3b]
  - @auriclabs/logger@0.0.6

## 0.0.8

### Patch Changes

- Updated dependencies [6680378]
  - @auriclabs/logger@0.0.5

## 0.0.7

### Patch Changes

- 1af8530: Fix for linking of packages

## 0.0.6

### Patch Changes

- a37fbc1: Added array functionality

## 0.0.5

### Patch Changes

- bdcd170: Fix for errors being thrown due to sst utils

## 0.0.4

### Patch Changes

- 498f5e2: Added register functions and improved register-api-routes

## 0.0.3

### Patch Changes

- ef69a0a: Update lodash to lodash-es

## 0.0.2

### Patch Changes

- 732042e: Bump esm module exports
