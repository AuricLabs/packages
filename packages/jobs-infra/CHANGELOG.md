# @auriclabs/jobs-infra

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
