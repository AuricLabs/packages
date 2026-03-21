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

ElectroDB entity with fields: `jobId`, `attempt`, `status`, `error`, `response`, `duration`, `startedAt`, `scheduledAt`, `completedAt`, `failedAt`, `createdAt`, `updatedAt`.

### `JobExecutionError`

Custom error class thrown when job execution fails. Has `.started` and `.completed` getters to determine job state.

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
