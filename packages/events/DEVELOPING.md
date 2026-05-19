# Developing `@auriclabs/events`

This package is the CQRS / event-sourcing runtime: append events to a
DynamoDB-backed event store, fan out via a DDB stream + SQS subscribers, and
dispatch in consumer Lambdas with `createEventListener`.

## Staleness policy

`createEventListener` supports an opt-in staleness policy so consumers can
choose what to do when an event arrives well after `occurredAt` (e.g. via a
recovery script after a fan-out outage).

### API surface

```ts
interface StalenessPolicy {
  maxAgeMs: number;                       // Infinity to disable the check
  onStale: 'skip' | 'process-degraded' | 'process-normally';
}

const DEFAULT_POLICY: StalenessPolicy = {
  maxAgeMs: Infinity,
  onStale: 'process-normally',
};

eventAgeMs(event, now?): number          // 0 on negative skew, missing/unparseable occurredAt
isStale(event, policy): boolean          // false when maxAgeMs is Infinity

createEventListener(handlers, {
  staleness?: StalenessPolicy,                       // default for all event types
  stalenessByEventType?: Record<string, StalenessPolicy>, // per-type override (beats default)
});
```

`EventRecord.meta` is the wire-only carrier for staleness/replay info:

```ts
interface EventRecord<P> {
  // ...
  meta?: {
    replay?: boolean;   // set by recovery scripts on republished SQS bodies
    isStale?: boolean;  // set by the listener under `process-degraded`
    ageMs?: number;     // set by the listener under `process-degraded`
  };
}
```

### Pick a policy per consumer

- **Re-projection consumers** (archive / insights / domain state machines that
  rebuild from event history): keep the default. Replays are safe.
- **Time-sensitive real-world side effects** (SMS, notifications, webhooks,
  promo codes): `skip` after a short window — a 10-day-late SMS is
  user-hostile and untraceable.
- **Idempotent-but-stamped** side effects that you want to fire with a
  visible "delivered late" downgrade: `process-degraded`. The handler reads
  `event.meta.isStale` / `event.meta.ageMs` and adapts.

Suggested starting policies (revise per service):

| Consumer       | maxAgeMs | onStale            |
|----------------|----------|--------------------|
| notifications  | 10 min   | skip               |
| webhooks       | 10 min   | skip               |
| mobile (SMS)   | 5 min    | skip               |
| promotions     | 1 hour   | skip               |
| billing/agents/compute/integrations/chat/org/database/memory/auth/templates | Infinity | process-normally |

### Invariants you MUST NOT break

- **`meta` is wire-only — never persisted.** `event-service.appendEvent`
  intentionally omits `meta` from the `Item` it writes. `meta.replay` only
  lives on republished SQS bodies, and `meta.isStale` / `meta.ageMs` are set
  by the listener in memory just before handler invocation. The canonical
  event-store row stays meta-free so historical truth can never be polluted
  by transport-layer state.

- **FIFO `failedGroups` is not touched by `skip`.** A stale-skip is an ack,
  not a failure. Subsequent same-group records are evaluated independently
  (each gets its own staleness check). If a future change couples skip to
  failedGroups, you'll silently poison every same-group event after a single
  skip — don't do it.

- **`occurredAt` is the only authoritative timestamp.** Do not add a
  `receivedAt` field to `EventRecord`. Cold-start, SQS visibility, and Lambda
  throttling all sit between "received" and "handled" — `Date.now()` at
  handler entry (used by `eventAgeMs`) is what matters. Adding `receivedAt`
  would change the wire format on every event and invite confusion.

### Recovery script integration

Out-of-band recovery scripts (e.g. `scripts/recover-events.ts` in consuming
repos) MUST set `meta.replay = true` on each republished event body BEFORE
`JSON.stringify` into `MessageBody`. Use the payload field, not an SQS message
attribute — EventBridge fan-out does not forward SQS attributes through to
subscriber queues.

```ts
const replayedBody = JSON.stringify({
  ...event,
  meta: { ...event.meta, replay: true },
});
```

Handlers that want to log/metric replays read `event.meta?.replay` inside
the handler body. The staleness policy is orthogonal — a replayed event that
arrives within `maxAgeMs` is not stale; a stale event need not be a replay.

## Releasing

This package's downstream peer (`@auriclabs/events-infra`) declares a
peerDependency of `^0.4.x` on us. A **minor bump on events forces a major
bump on events-infra** (caret ranges don't cross minor when the major is 0).

**Rule:** keep changeset bumps `patch` until either:

1. The peerDep range on `events-infra` is widened to e.g. `>=0.4.0 <1.0.0`, or
2. You explicitly want to ship a coordinated major across the events surface.

Adding additive API (like the staleness policy above) does NOT justify a minor
bump on its own — patch it.
