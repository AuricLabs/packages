# @auriclabs/jobs-infra

## 2.2.0

### Minor Changes

- dd6d044: Take the `sst` components namespace as an explicit parameter in `createJobTable` and
  `createJobsDashboard` instead of referencing the injected `sst` global.

  `@auriclabs/jobs-infra` ships as ESM (`dist/index.mjs`). SST's config evaluator injects the `sst`
  global into config source through an esbuild `onLoad` plugin whose filter is
  `\.(js|ts|jsx|tsx)# @auriclabs/jobs-infra, which deliberately skips `.mjs`/`.cjs`. (`$app` / `$jsonStringify`/`$output`arrive via esbuild`Define`/`Inject`, which are extension-agnostic and keep working — only the `sst`namespace and`@pulumi/\*`provider aliases come from the skipped`onLoad`channel.) A bare`sst.aws.Dynamo`reference in the`.mjs`build therefore threw`ReferenceError:
  sst is not
  defined`at deploy time. Passing`sst`in as a parameter — as`@auriclabs/migrations`' `createTable(sst)`
  already does — sidesteps the injection entirely.

  Breaking:
  - `createJobTable(name)` → `createJobTable(sst, name)`
  - `createJobsDashboard(options)` now requires `options.sst`

  `registerJobResources` is unchanged: it only uses `$jsonStringify` (an `Inject` global that works
  in `.mjs`) plus caller-supplied resources.

## 2.1.0

### Minor Changes

- 2f09e53: Add typed job registry (defineJobs), in-process registry executor
  (createRegistryExecutorHandler), continuation/time-budget helpers (continueJob, createTimeBudget)
  with per-attempt continuation state, and retryJob (which resumes from the last attempt's
  continuation state). Fix prepareNextJobAttempt to allow retrying failed jobs and to reject
  concurrent attempts on running jobs.

  Add a jobs dashboard modeled on the migrations dashboard: a bundled Vite/React UI (ui/), a
  dashboard API (createJobsDashboardApiHandler — list/summary/detail/retry/cancel; no job creation),
  list/summary read methods on the job service, and an `auric-jobs-dashboard` local CLI that serves
  the same UI against a deployed table via SSO.

  jobs-infra: add 'in-process' executor resource variant that subscribes a consumer-provided handler
  with QUEUE_URL_LIST wired, wire QUEUE_URL_LIST on the lambda executor so scheduledAt re-enqueue
  works there too, and add createJobsDashboard (ApiGatewayV2 + StaticSite + optional CloudFront
  basic-auth) for deploying the dashboard.

### Patch Changes

- Updated dependencies [2f09e53]
  - @auriclabs/jobs@0.3.0

## 2.0.0

### Patch Changes

- Updated dependencies [f67ca30]
  - @auriclabs/sst-utils@1.2.0

## 1.0.0

### Patch Changes

- Updated dependencies [3d3f935]
  - @auriclabs/sst-utils@1.1.0

## 0.2.0

### Minor Changes

- eeb513b: Add @auriclabs/jobs-infra package with SST infrastructure components for job table and
  job resources.

### Patch Changes

- Updated dependencies [eeb513b]
- Updated dependencies [1c34bf8]
  - @auriclabs/sst-utils@1.0.1
