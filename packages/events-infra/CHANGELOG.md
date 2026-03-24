# @auriclabs/events-infra

## 1.0.1

### Patch Changes

- df1699e: Change default dlqRetries from 3 to 1 in createEventQueue to reduce FIFO message group
  blocking time on failures.
- Updated dependencies [adb821b]
  - @auriclabs/events@0.4.1

## 1.0.0

### Minor Changes

- ddd017a: Add createEventQueue helper, make EventBridge bus optional, and bundle a pre-built stream
  handler to eliminate consumer boilerplate.

### Patch Changes

- Updated dependencies [ddd017a]
  - @auriclabs/events@0.4.0

## 0.3.0

### Minor Changes

- 9614859: Add tenantId to EventRecord and a tenantIndex GSI on the event store for tenant-scoped
  queries.

## 0.2.0

### Minor Changes

- eeb513b: Add @auriclabs/events-infra package with SST infrastructure components for event bus,
  event listeners, and event store.
