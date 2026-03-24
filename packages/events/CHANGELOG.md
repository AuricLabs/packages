# @auriclabs/events

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
