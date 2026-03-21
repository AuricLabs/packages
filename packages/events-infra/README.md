# @auriclabs/events-infra

SST infrastructure helpers for provisioning DynamoDB event stores, EventBridge buses, and DynamoDB stream subscriptions.

## Setup

```bash
pnpm add @auriclabs/events-infra
```

### Peer dependencies

```bash
pnpm add sst @auriclabs/sst-types
```

## API Reference

### `createEventStore(name, options?)`

Creates a DynamoDB table configured for event sourcing with `pk`/`sk` keys, DynamoDB Streams enabled, and `STANDARD_INFREQUENT_ACCESS` storage class.

```typescript
import { createEventStore } from '@auriclabs/events-infra';

export const table = createEventStore('EventStoreTable');
```

Options:

```typescript
interface CreateEventStoreOptions {
  transform?: {
    table?: Record<string, unknown>;  // Override default table transform
  };
}
```

Returns: `sst.aws.Dynamo`

### `createEventBus(name)`

Creates an EventBridge bus.

```typescript
import { createEventBus } from '@auriclabs/events-infra';

export const bus = createEventBus('EventBus');
```

Returns: `sst.aws.Bus`

### `subscribeEventStream(config)`

Subscribes a Lambda handler to the DynamoDB event store stream. Filters for `itemType: 'event'` records only (skips HEAD updates). Links the EventBridge bus and all listener queues, and sets the `QUEUE_URL_LIST` environment variable.

```typescript
import { subscribeEventStream } from '@auriclabs/events-infra';

subscribeEventStream({
  table: eventTable,
  bus: eventBus,
  listenerQueues: [crawlerQueue, indexerQueue],
  handlerPath: 'services/event/handlers/event-store-table-stream.handler',
});
```

Config:

```typescript
interface SubscribeEventStreamConfig {
  table: sst.aws.Dynamo;
  bus: sst.aws.Bus;
  listenerQueues: sst.aws.Queue[];
  handlerPath: string;  // Lambda handler path
}
```

## Full Example

```typescript
// infra/event.ts
import { createEventStore, createEventBus, subscribeEventStream } from '@auriclabs/events-infra';
import * as services from './services';

export const table = createEventStore('EventStoreTable');
export const bus = createEventBus('EventBus');

subscribeEventStream({
  table,
  bus,
  listenerQueues: [
    services.crawler.eventListenerQueue,
    services.indexer.eventListenerQueue,
  ],
  handlerPath: 'services/event/handlers/event-store-table-stream.handler',
});
```

The stream handler should use `createStreamHandler()` from `@auriclabs/events`:

```typescript
// services/event/handlers/event-store-table-stream.ts
import { createStreamHandler } from '@auriclabs/events';
import { Resource } from 'sst';

export const handler = createStreamHandler({
  busName: Resource.EventBus.name,
  queueUrls: JSON.parse(process.env.QUEUE_URL_LIST ?? '[]'),
});
```
