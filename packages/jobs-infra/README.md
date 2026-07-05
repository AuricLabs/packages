# @auriclabs/jobs-infra

SST infrastructure helpers for provisioning DynamoDB job tables, SQS queues, and Lambda executor subscriptions.

## Setup

```bash
pnpm add @auriclabs/jobs-infra
```

### Peer dependencies

```bash
pnpm add sst @auriclabs/sst-types @auriclabs/sst-utils
```

## API Reference

### `createJobTable(name)`

Creates a DynamoDB table with the standard job queue schema: primary index, number index, GSI1, and DynamoDB Streams enabled.

```typescript
import { createJobTable } from '@auriclabs/jobs-infra';

export const table = createJobTable('JobTable');
```

Returns: `sst.aws.Dynamo`

Table schema:
| Field | Type | Index |
|-------|------|-------|
| `pk` | string | Primary hash key |
| `sk` | string | Primary range key |
| `numberIndexPk` | string | numberIndex hash key |
| `numberIndexSk` | number | numberIndex range key |
| `gsi1pk` | string | gsi1 hash key |
| `gsi1sk` | string | gsi1 range key |

### `registerJobResources(config)`

Registers job resources: subscribes the DynamoDB stream handler and sets up Lambda executor queue subscriptions.

```typescript
import { registerJobResources } from '@auriclabs/jobs-infra';

registerJobResources({
  table: jobTable,
  resources: [
    {
      id: 'lambda',
      executor: 'lambda',
      queue: lambdaJobQueue,
      fns: [workerFn1, workerFn2],
    },
    {
      id: 'worker',
      queue: workerQueue,
      // No executor — custom processing
    },
  ],
  handlerPaths: {
    stream: 'services/job/handlers/job-table-stream.handler',
    executor: 'services/job/handlers/lambda-executor.handler',
  },
});
```

Config:

```typescript
interface RegisterJobResourcesConfig {
  table: sst.aws.Dynamo;
  resources: JobResource[];
  handlerPaths: {
    stream: string;    // DynamoDB stream handler path
    executor: string;  // Lambda executor handler path
  };
}
```

### Resource Types

```typescript
// Lambda-executed jobs: SQS → Lambda executor → target Lambda
interface LambdaJobResource {
  id: string;
  executor: 'lambda';
  queue: sst.aws.Queue;
  fns: FunctionWithName[];  // From @auriclabs/sst-utils
}

// In-process jobs: SQS → consumer runs registered handlers directly
interface InProcessJobResource {
  id: string;
  executor: 'in-process';
  queue: sst.aws.Queue;
  handler: string;          // wraps createRegistryExecutorHandler(...) from @auriclabs/jobs
  link?: unknown[];         // extra linkables the handlers depend on
  environment?: Record<string, string>;
}

// Worker jobs: SQS → custom processing (no executor subscription)
interface WorkerJobResource {
  id: string;
  executor?: never;
  queue: sst.aws.Queue;
}

type JobResource = LambdaJobResource | InProcessJobResource | WorkerJobResource;
```

Example `'in-process'` executor wiring:

```typescript
registerJobResources({
  table,
  resources: [
    {
      id: 'worker',
      executor: 'in-process',
      queue: workerJobQueue,
      handler: 'services/job/handlers/registry-executor.handler',
      link: [bucket],
    },
  ],
  handlerPaths: { ... },
});
```

```typescript
// services/job/handlers/registry-executor.ts
import { createRegistryExecutorHandler, initJobs } from '@auriclabs/jobs';
import { Resource } from 'sst';

initJobs({ tableName: Resource.JobTable.name });
export const handler = createRegistryExecutorHandler({
  syncItems: async (payload) => { /* ... */ },
});
```

### What `registerJobResources` sets up

1. **DynamoDB stream subscription** on the job table
   - Filters for `job-attempt` entity records only (ElectroDB `__edb_e__` field)
   - Links the table and all queues
   - Sets `QUEUE_URL_LIST` env var (maps queue IDs to URLs)

2. **Lambda executor subscriptions** for each `LambdaJobResource`
   - Subscribes queue to executor handler
   - Links table, queue, and target Lambda functions
   - Sets `LAMBDA_FUNCTION_LIST` env var (maps function names to ARNs)
   - Batch config: 10 items, 3 second window, partial responses enabled

3. **In-process executor subscriptions** for each `InProcessJobResource` (`executor: 'in-process'`)
   - Subscribes queue to the consumer-provided handler
   - Links table, queue, and any extra `link` entries
   - Sets `QUEUE_URL_LIST` env var (needed for scheduledAt re-enqueue and continuations)
   - Same batch config as the Lambda executor

## Full Example

```typescript
// infra/job.ts
import { createJobTable, registerJobResources } from '@auriclabs/jobs-infra';

export const table = createJobTable('JobTable');

export const lambdaJobDeadLetterQueue = new sst.aws.Queue('LambdaJobDeadLetterQueue');
export const lambdaJobQueue = new sst.aws.Queue('LambdaJobQueue', {
  delay: '0 seconds',
  visibilityTimeout: '10 minutes',
  dlq: {
    retry: 3,
    queue: lambdaJobDeadLetterQueue.arn,
  },
});

registerJobResources({
  table,
  resources: [
    {
      id: 'lambda',
      executor: 'lambda',
      queue: lambdaJobQueue,
      fns: [crawlerWorker, indexerWorker],
    },
  ],
  handlerPaths: {
    stream: 'services/job/handlers/job-table-stream.handler',
    executor: 'services/job/handlers/lambda-executor.handler',
  },
});
```

The handlers should use factories from `@auriclabs/jobs`:

```typescript
// services/job/handlers/job-table-stream.ts
import { createJobTableStreamHandler, initJobs } from '@auriclabs/jobs';
import { Resource } from 'sst';

initJobs({ tableName: Resource.JobTable.name });
export const handler = createJobTableStreamHandler();

// services/job/handlers/lambda-executor.ts
import { createLambdaExecutorHandler, initJobs } from '@auriclabs/jobs';
import { Resource } from 'sst';

initJobs({ tableName: Resource.JobTable.name });
export const handler = createLambdaExecutorHandler();
```
