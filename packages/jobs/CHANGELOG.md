# @auriclabs/jobs

## 0.4.0

### Minor Changes

- 04afb31: Migration-dashboard parity for job logs and re-runs. Job handlers get `context.log` /
  `context.logger` that capture output onto the attempt row (byte-capped OutputBuffer, `output` +
  `outputTruncated` attributes, persisted on completion, failure, and continuation slices —
  per-attempt and concurrency-safe). The dashboard's attempt detail renders the captured output with
  copy + truncation notice, and the retry action is labeled Re-run for completed jobs vs Retry for
  failed ones (same endpoint underneath).

## 0.3.0

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

## 0.2.0

### Minor Changes

- eeb513b: Add @auriclabs/jobs package with job scheduling, processing, and management using
  DynamoDB and SQS.

### Patch Changes

- Updated dependencies [eeb513b]
  - @auriclabs/api-core@0.1.1
  - @auriclabs/logger@0.1.1
  - @auriclabs/pagination@1.0.1
