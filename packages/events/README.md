# @auriclabs/events

Event sourcing runtime utilities for DynamoDB-backed event stores. Provides event dispatching, listeners, context management, and DynamoDB stream handling.

## Setup

```bash
pnpm add @auriclabs/events
```

### Peer dependencies

```bash
pnpm add @auriclabs/api-core @auriclabs/logger @auriclabs/pagination
pnpm add @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-eventbridge @aws-sdk/client-sqs @aws-sdk/util-dynamodb
```

## Initialization

Call `initEvents()` once per Lambda cold start before using any event functions:

```typescript
import { initEvents } from '@auriclabs/events';
import { Resource } from 'sst';

initEvents({ tableName: Resource.EventStoreTable.name });
```

## API Reference

### `initEvents(config: { tableName: string })`

Initializes the module-level event service with the DynamoDB table name. Must be called before any other function.

### `getEventService(): EventService`

Returns the initialized `EventService` instance. Throws if `initEvents()` hasn't been called.

### `EventService` interface

```typescript
interface EventService {
  appendEvent<P>(args: AppendArgs<P>): Promise<AppendEventResult>;
  getHead(aggregateType: string, aggregateId: string): Promise<AggregateHead | undefined>;
  getEvent(aggregateType: string, aggregateId: string, version: number): Promise<EventRecord | undefined>;
  listEvents(params: {
    aggregateType: string;
    aggregateId: string;
    fromVersionExclusive?: number;
    toVersionInclusive?: number;
    limit?: number;
  }): Promise<PaginationResponse<EventRecord>>;
}
```

Low-level DynamoDB operations with optimistic concurrency control and idempotent writes. Most consumers should use `createDispatch()` instead.

### `createDispatch(record, options?)`

Type-safe factory for creating domain-specific dispatch functions. This is the primary way to dispatch events.

```typescript
import { createDispatch } from '@auriclabs/events';

const dispatch = createDispatch(
  {
    funded: (walletId: string, amount: number) => ({
      aggregateId: walletId,
      eventType: 'Wallet.Funded',
      payload: { amount },
    }),
    withdrawn: (walletId: string, amount: number) => ({
      aggregateId: walletId,
      eventType: 'Wallet.Withdrawn',
      payload: { amount },
    }),
  },
  { aggregateType: 'wallet', source: 'billing' },
);

// Usage:
await dispatch.funded('wal_123', 5000);
await dispatch.withdrawn('wal_123', 1000);
```

Each dispatch function automatically:
- Generates a ULID-based `eventId`
- Reads the current aggregate HEAD for version tracking
- Retries on OCC conflicts
- Merges event context (correlation/causation/actor IDs)

### `dispatchEvent(event: DispatchEventArgs)`

Low-level single event dispatch. Auto-generates `eventId`, reads HEAD version, retries on OCC.

```typescript
import { dispatchEvent } from '@auriclabs/events';

await dispatchEvent({
  aggregateType: 'wallet',
  aggregateId: 'wal_123',
  source: 'billing',
  eventType: 'Wallet.Funded',
  payload: { amount: 5000 },
});
```

### `dispatchEvents(events, options?)`

Dispatches multiple events. By default dispatches in parallel. Set `{ inOrder: true }` for sequential dispatch (required when events target the same aggregate).

```typescript
import { dispatchEvents } from '@auriclabs/events';

await dispatchEvents([event1, event2, event3], { inOrder: true });
```

### `createEventListener(handlers, options?)`

Creates an SQS batch handler for processing events. Returns a Lambda handler function.

```typescript
import { createEventListener } from '@auriclabs/events';

export const handler = createEventListener({
  'Wallet.Funded': async (event) => {
    // Process the event
    console.log(event.payload, event.aggregateId);
  },
  // String values create aliases:
  'Wallet.Credited': 'Wallet.Funded',
}, { debug: true });
```

The listener:
- Parses `EventRecord` from SQS message body
- Resolves string aliases to handler functions
- Sets event context (causation/correlation/actor IDs) before calling the handler
- Returns `SQSBatchResponse` with failures for partial batch retry

### `createStreamHandler(config)`

Creates a DynamoDB Streams handler that fans out events to SQS queues and EventBridge.

```typescript
import { createStreamHandler } from '@auriclabs/events';
import { Resource } from 'sst';

export const handler = createStreamHandler({
  busName: Resource.EventBus.name,
  queueUrls: JSON.parse(process.env.QUEUE_URL_LIST ?? '[]'),
});
```

### Context Management

```typescript
import { setEventContext, getEventContext, resetEventContext, appendEventContext } from '@auriclabs/events';

// Set context for current request
setEventContext({ correlationId: 'corr-123', actorId: 'user-456' });

// Read current context
const ctx = getEventContext();

// Append to existing context
appendEventContext({ causationId: 'evt-789' });

// Reset between requests
resetEventContext();
```

Context is automatically merged into dispatched events. `createEventListener` sets causation/correlation context from the incoming event.

## Types

### `EventRecord<P>`

```typescript
interface EventRecord<P = unknown> {
  pk: AggregatePK;           // "AGG#{type}#{id}"
  sk: EventSK;               // "EVT#000000042"
  itemType: 'event';
  source: Source;
  aggregateId: AggregateId;
  aggregateType: AggregateType;
  version: number;
  eventId: EventId;
  eventType: string;
  schemaVersion?: number;
  occurredAt: string;        // ISO timestamp
  correlationId?: string;
  causationId?: string;
  actorId?: string;
  payload: Readonly<P>;
}
```

### `AggregateHead`

```typescript
interface AggregateHead {
  pk: AggregatePK;
  sk: 'HEAD';
  itemType: 'head';
  aggregateId: AggregateId;
  aggregateType: AggregateType;
  currentVersion: number;
  lastEventId?: EventId;
  lastIdemKey?: string;
  updatedAt: string;
}
```

### Branded types

`Source`, `AggregateId`, `AggregateType`, `EventId` — branded string types for type safety. Cast with `as Source`, etc.

## DynamoDB Table Schema

The event store uses a single-table design:

| Key | Format | Description |
|-----|--------|-------------|
| `pk` | `AGG#{aggregateType}#{aggregateId}` | Partition key |
| `sk` | `EVT#{version}` or `HEAD` | Sort key |

Events are immutable INSERT records. HEAD is updated atomically with each event via DynamoDB transactions.
