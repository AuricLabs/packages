import { EventRecord } from './types';

/**
 * Staleness policy applied per event in the listener dispatch loop.
 *
 * - `maxAgeMs`: events older than this (by `occurredAt`) are considered stale.
 *   Use `Infinity` to disable the staleness check.
 * - `onStale`: what the listener does when an event is stale.
 *    - `'skip'`             — ack the SQS record without invoking the handler.
 *                             Does NOT touch FIFO `failedGroups` (skipped != failed).
 *    - `'process-degraded'` — invoke the handler, but first mutate the event in
 *                             place to set `meta.isStale = true` and `meta.ageMs`,
 *                             so the handler can downgrade its side effects.
 *    - `'process-normally'` — no-op (default; current behavior).
 */
export interface StalenessPolicy {
  maxAgeMs: number;
  onStale: 'skip' | 'process-degraded' | 'process-normally';
}

/**
 * Default policy: no staleness check, always process normally.
 * Preserves existing listener behavior for consumers that don't opt in.
 */
export const DEFAULT_POLICY: StalenessPolicy = {
  maxAgeMs: Infinity,
  onStale: 'process-normally',
};

/**
 * Age in ms of an event relative to `now` (defaults to `Date.now()`).
 * Returns 0 for negative clock skew (event.occurredAt in the future).
 * Returns 0 if `occurredAt` is missing or unparseable.
 */
export const eventAgeMs = (event: EventRecord, now: number = Date.now()): number => {
  if (!event.occurredAt) return 0;
  const t = Date.parse(event.occurredAt);
  if (Number.isNaN(t)) return 0;
  const age = now - t;
  return age < 0 ? 0 : age;
};

/**
 * True iff the event's age exceeds the policy's `maxAgeMs`.
 * Always false when `maxAgeMs` is `Infinity`.
 */
export const isStale = (event: EventRecord, policy: StalenessPolicy): boolean => {
  if (!Number.isFinite(policy.maxAgeMs)) return false;
  return eventAgeMs(event) > policy.maxAgeMs;
};
