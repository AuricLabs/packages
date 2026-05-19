# @auriclabs/events

## 0.4.4

### Patch Changes

- 662ec77: Add opt-in staleness policy to `createEventListener`. New surface (purely additive,
  default behavior unchanged):
  - `StalenessPolicy { maxAgeMs; onStale: 'skip' | 'process-degraded' | 'process-normally' }`
  - `DEFAULT_POLICY = { maxAgeMs: Infinity, onStale: 'process-normally' }`
  - `eventAgeMs(event, now?)` and `isStale(event, policy)` helpers
  - `CreateEventListenerOptions.staleness` (default) and `stalenessByEventType` (per-type override)
  - `EventRecord.meta?: { replay?; isStale?; ageMs? }` — wire-only metadata, never persisted by
    `event-service.appendEvent`

  Consumers can now opt into skip-or-degrade behavior for time-sensitive side effects
  (SMS/notifications/webhooks) so out-of-band replays don't fire stale real-world actions.
  Re-projection consumers keep the default and replay safely.

  **Why this is `patch`, not `minor`, even though the API is additive:** `@auriclabs/events-infra`
  has a peerDependency on `@auriclabs/events` of `^0.4.x`. A minor bump on `events` forces a major
  bump on `events-infra` (caret ranges don't cross minor when the major is 0). Until the peerDep is
  widened, every release on `events` stays patch — including ones that add public API surface. If
  you're adding more surface here, keep it patch unless you intentionally want to cascade a major on
  `events-infra`.

## 0.4.3

### Patch Changes

- 98e57d6: stream-handler: detect FIFO queues by `.fifo` URL suffix and only include
  `MessageGroupId` / `MessageDeduplicationId` on entries when the target is FIFO. Standard SQS
  queues reject those attributes per-entry in `Failed[]`, so sending them on every batch caused
  silent message loss on any standard listener queue in a fan-out.

  Also: any non-empty `Failed[]` on `SendMessageBatch`, or `FailedEntryCount > 0` on EventBridge
  `PutEvents`, now throws — partial failures previously went unobserved. The existing error logs no
  longer include full event payloads (eventId / aggregateId / aggregateType / eventType only) to
  reduce PII leakage into CloudWatch.

## 0.4.2

### Patch Changes

- 078f752: Fix DLQ cascading failures: track failed message groups instead of global hasFailed flag
  so one aggregate's failure no longer sends unrelated aggregates to DLQ

## 0.4.1

### Patch Changes

- adb821b: Fix broken type declarations by splitting tsdown into separate invocations to avoid DTS
  code-splitting bug with multiple entry points.

## 0.4.0

### Minor Changes

- ddd017a: Add createEventQueue helper, make EventBridge bus optional, and bundle a pre-built stream
  handler to eliminate consumer boilerplate.

## 0.3.0

### Minor Changes

- 9614859: Add tenantId to EventRecord and a tenantIndex GSI on the event store for tenant-scoped
  queries.

## 0.2.0

### Minor Changes

- eeb513b: Add @auriclabs/events package with event dispatching, event listeners, stream handler,
  and event service for DynamoDB-backed event sourcing.

### Patch Changes

- Updated dependencies [eeb513b]
  - @auriclabs/api-core@0.1.1
  - @auriclabs/logger@0.1.1
  - @auriclabs/pagination@1.0.1
