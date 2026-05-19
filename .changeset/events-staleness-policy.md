---
"@auriclabs/events": patch
---

Add opt-in staleness policy to `createEventListener`. New surface (purely
additive, default behavior unchanged):

- `StalenessPolicy { maxAgeMs; onStale: 'skip' | 'process-degraded' | 'process-normally' }`
- `DEFAULT_POLICY = { maxAgeMs: Infinity, onStale: 'process-normally' }`
- `eventAgeMs(event, now?)` and `isStale(event, policy)` helpers
- `CreateEventListenerOptions.staleness` (default) and `stalenessByEventType` (per-type override)
- `EventRecord.meta?: { replay?; isStale?; ageMs? }` — wire-only metadata,
  never persisted by `event-service.appendEvent`

Consumers can now opt into skip-or-degrade behavior for time-sensitive side
effects (SMS/notifications/webhooks) so out-of-band replays don't fire stale
real-world actions. Re-projection consumers keep the default and replay safely.

**Why this is `patch`, not `minor`, even though the API is additive:**
`@auriclabs/events-infra` has a peerDependency on `@auriclabs/events` of
`^0.4.x`. A minor bump on `events` forces a major bump on `events-infra`
(caret ranges don't cross minor when the major is 0). Until the peerDep is
widened, every release on `events` stays patch — including ones that add
public API surface. If you're adding more surface here, keep it patch unless
you intentionally want to cascade a major on `events-infra`.
