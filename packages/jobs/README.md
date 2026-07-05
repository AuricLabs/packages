# @auriclabs/jobs

Job queue system built on DynamoDB + SQS + Lambda. Supports job scheduling, retry logic, FIFO ordering, and Lambda-based execution.

## Setup

```bash
pnpm add @auriclabs/jobs
```

### Peer dependencies

```bash
pnpm add @auriclabs/api-core @auriclabs/logger @auriclabs/pagination
pnpm add @aws-sdk/client-dynamodb @aws-sdk/client-lambda @aws-sdk/client-sqs @aws-sdk/util-dynamodb
pnpm add electrodb http-errors-enhanced
```

## Initialization

Call `initJobs()` once per Lambda cold start:

```typescript
import { initJobs } from '@auriclabs/jobs';
import { Resource } from 'sst';

initJobs({ tableName: Resource.JobTable.name });
```

This creates all ElectroDB entities and service instances. The job queue service reads `QUEUE_URL_LIST` from `process.env`, and the Lambda executor reads `LAMBDA_FUNCTION_LIST` from `process.env`.

## API Reference

### Scheduling Jobs

```typescript
import { scheduleJob } from '@auriclabs/jobs';

const { job, jobAttempt } = await scheduleJob(
  'lambda',                         // queue name
  'MyWorkerFunction',               // Lambda function key
  { url: 'https://example.com' },   // payload
  '2025-12-01T00:00:00.000Z',      // optional: scheduled time (ISO string)
);
```

### Job Lifecycle

Jobs follow this lifecycle:

```
pending → running → completed
                  → failed
```

1. `scheduleJob()` creates a job + first attempt in `pending` state
2. DynamoDB stream triggers → job attempt added to SQS queue
3. SQS triggers Lambda executor → `startJob()` marks as `running`
4. Executor invokes target Lambda → `stopJob()` marks as `completed` or `failed`

### Handlers

#### `createJobTableStreamHandler()`

Creates a DynamoDB Streams handler that watches for job attempt INSERTs and MODIFYs, adding them to the appropriate SQS queue.

```typescript
import { createJobTableStreamHandler, initJobs } from '@auriclabs/jobs';
import { Resource } from 'sst';

initJobs({ tableName: Resource.JobTable.name });

export const handler = createJobTableStreamHandler();
```

#### `createLambdaExecutorHandler()`

Creates an SQS handler that executes jobs by invoking Lambda functions. Supports both FIFO and standard queues.

```typescript
import { createLambdaExecutorHandler, initJobs } from '@auriclabs/jobs';
import { Resource } from 'sst';

initJobs({ tableName: Resource.JobTable.name });

export const handler = createLambdaExecutorHandler();
```

FIFO queue behavior: processes sequentially, stops on first failure.
Standard queue behavior: processes in parallel, collects individual failures.

#### `createRegistryExecutorHandler(handlers)`

In-process alternative to the Lambda executor: instead of invoking a separate
target Lambda per job `fn`, runs a registered handler inside the SQS consumer.
No second cold start, no cross-Lambda payload limit, one function to deploy.

```typescript
import { createRegistryExecutorHandler, initJobs } from '@auriclabs/jobs';
import { Resource } from 'sst';

initJobs({ tableName: Resource.JobTable.name });

export const handler = createRegistryExecutorHandler({
  syncItems: async (payload, context) => {
    // return raw data — wrapped as { success: true, data }
    return { processed: 42 };
  },
  sendEmail: async (payload) => {
    // return nothing — wrapped as { success: true }
  },
});
```

Handlers return raw data (wrapped as a success response), a `JobContinuation`
(see below), or throw to fail the attempt. An unregistered `fn` fails the
attempt with a clear error. Wire the consumer with the `'in-process'` executor
resource in `@auriclabs/jobs-infra`.

### Typed job registry

`defineJobs<T>()` adds compile-time safety over the untyped core: job `fn`
keys and payload shapes are checked when scheduling, and the handler map must
cover every declared job type.

```typescript
import { defineJobs } from '@auriclabs/jobs';

interface MyJobs {
  syncItems: { cursor?: string };
  cloneItem: { itemId: string; count: number };
}

export const jobs = defineJobs<MyJobs>();

// payload and fn key are type-checked
await jobs.scheduleJob('worker', 'cloneItem', { itemId: 'x', count: 2 });

// missing or mistyped handlers are compile errors
export const handler = jobs.createRegistryExecutorHandler({
  syncItems: async (payload) => { /* payload: { cursor?: string } */ },
  cloneItem: async (payload) => ({ clonedId: payload.itemId }),
});
```

### Long-running jobs (continuations)

Jobs that exceed the Lambda time limit can process a slice, then return a
continuation carrying a cursor. The current attempt completes, the job goes
straight back to `pending` (never a false `completed` for status pollers),
and a new attempt is created with the cursor in its `state` field.

```typescript
import { continueJob, createTimeBudget } from '@auriclabs/jobs';

export const handler = jobs.createRegistryExecutorHandler({
  syncItems: async (payload, context) => {
    const budget = createTimeBudget(5 * 60 * 1000); // 5 minutes
    let cursor = (context.jobAttempt.state as { cursor?: string } | undefined)?.cursor;

    do {
      cursor = await syncPage(cursor);
    } while (budget.shouldRun(cursor));

    if (cursor) {
      return continueJob({ cursor }); // schedule the next slice
    }
    return { done: true };
  },
});
```

Note: each continuation slice counts as an attempt (`totalAttempts` includes
slices, not just retries).

### Retrying failed jobs

```typescript
import { retryJob } from '@auriclabs/jobs';

const { jobAttempt } = await retryJob('job-123');
// or defer the retry:
await retryJob('job-123', '2025-12-01T00:00:00.000Z');
```

Retry is allowed from `pending`, `completed`, and `failed` — never while
`running` or after `cancelled`. For long-running jobs, the retry carries the
last attempt's continuation `state`, so a failed slice resumes from its cursor
instead of restarting the whole job.

### Helper Functions

```typescript
import {
  scheduleJob,    // Create job + first attempt
  startJob,       // Validate and mark attempt as running
  stopJob,        // Record completion/failure with duration
  executeJob,     // Full lifecycle: start → execute → stop
  getJobContext,  // Fetch job + attempt by ID
} from '@auriclabs/jobs';
```

#### `executeJob(message, executor)`

Orchestrates the full job lifecycle. Used internally by `createLambdaExecutorHandler()`, but can also be used for custom executors:

```typescript
import { executeJob } from '@auriclabs/jobs';

await executeJob(
  { jobId: 'job-123', queue: 'lambda', attempt: 1 },
  async (context) => {
    // context.job, context.jobAttempt available
    const result = await doWork(context.job.payload);
    return { success: true, data: result };
  },
);
```

### Services (via init getters)

For advanced use cases, access services directly:

```typescript
import {
  getJobService,
  getJobAttemptService,
  getJobQueueService,
  getLambdaExecutorService,
} from '@auriclabs/jobs';

const jobService = getJobService();
const job = await jobService.getJob('job-123');
await jobService.updateJob('job-123', { status: 'cancelled' });

const jobAttemptService = getJobAttemptService();
const attempts = await jobAttemptService.getAllJobAttempts('job-123');
```

## Types

### `JobStatus`

```typescript
const jobStatus = {
  pending: 'pending',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
} as const;

type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
```

### `JobMessage`

```typescript
interface JobMessage {
  jobId: string;
  queue: string;
  attempt: number;
}
```

### `JobResponse`

```typescript
interface JobResponse {
  success?: boolean;
  error?: unknown;
  data?: unknown;
}
```

### `JobItem`

ElectroDB entity with fields: `id`, `queue`, `fn`, `status`, `totalAttempts`, `payload`, `createdAt`, `updatedAt`.

### `JobAttemptItem`

ElectroDB entity with fields: `jobId`, `attempt`, `status`, `error`, `response`, `state`, `duration`, `startedAt`, `scheduledAt`, `completedAt`, `failedAt`, `createdAt`, `updatedAt`. `state` carries the continuation cursor for long-running jobs.

### `JobExecutionError`

Custom error class thrown when job execution fails. Has `.started` and `.completed` getters to determine job state.

## Dashboard

The package ships a jobs dashboard (bundled Vite/React UI in `ui/` + a
Lambda API), modeled on the `@auriclabs/migrations` dashboard. It lists
jobs with status filtering, shows per-attempt history (errors, responses,
continuation state, durations), and can retry or cancel jobs. It cannot
create jobs.

### Dashboard API handler

```typescript
// services/job/dashboard.ts
import { createJobsDashboardApiHandler, initJobs } from '@auriclabs/jobs';
import { Resource } from 'sst';

initJobs({ tableName: Resource.JobTable.name });
export const handler = createJobsDashboardApiHandler();
```

Routes: `GET /api/jobs` (`status`/`cursor`/`limit` query params),
`GET /api/jobs/summary`, `GET /api/jobs/:id` (job + attempts),
`POST /api/jobs/:id/retry` (optional `{ scheduledAt }` body),
`POST /api/jobs/:id/cancel` (pending jobs only, 409 otherwise).

Deploy it with `createJobsDashboard()` from `@auriclabs/jobs-infra`.
Note the API is CORS-`*` and unauthenticated (basic-auth only gates the
static site) — deploy to dev/demo stages only.

### Local CLI dashboard

```bash
auric-jobs-dashboard
```

Picks an AWS SSO profile (auto-runs `aws sso login` on expiry), discovers
the deployed job table by name, and serves the same UI on
`http://127.0.0.1:3101` against the real table using your IAM identity.

## Environment Variables

| Variable | Format | Used by |
|----------|--------|---------|
| `QUEUE_URL_LIST` | `JSON.stringify([["queueId", "url"], ...])` | `jobQueueService` |
| `LAMBDA_FUNCTION_LIST` | `JSON.stringify([["fnKey", "arn"], ...])` | `lambdaExecutorService` |

These are typically set by `@auriclabs/jobs-infra`'s `registerJobResources()`.

## DynamoDB Table Schema

| Field | Type | Description |
|-------|------|-------------|
| `pk` | string | Partition key (job ID or job attempt composite) |
| `sk` | string | Sort key |
| `gsi1pk` / `gsi1sk` | string | GSI1 for job status queries |
| `numberIndexPk` / `numberIndexSk` | string/number | Number index for job attempt ordering |

Uses ElectroDB for entity management with two entities (`job`, `job-attempt`) in the same table.
