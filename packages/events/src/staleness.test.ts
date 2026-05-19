import { DEFAULT_POLICY, eventAgeMs, isStale, StalenessPolicy } from './staleness';

import type { EventRecord } from './types';

const makeEvent = (overrides: Partial<EventRecord> = {}): EventRecord =>
  ({
    eventId: 'evt-1',
    eventType: 'OrderCreated',
    tenantId: 'tenant-1',
    aggregateId: 'o-1',
    aggregateType: 'order',
    occurredAt: new Date().toISOString(),
    payload: {},
    ...overrides,
  }) as EventRecord;

describe('DEFAULT_POLICY', () => {
  it('is backwards-compatible — Infinity / process-normally', () => {
    expect(DEFAULT_POLICY.maxAgeMs).toBe(Infinity);
    expect(DEFAULT_POLICY.onStale).toBe('process-normally');
  });

  it('never marks an event stale', () => {
    const ancient = makeEvent({ occurredAt: '1970-01-01T00:00:00.000Z' });
    expect(isStale(ancient, DEFAULT_POLICY)).toBe(false);
  });
});

describe('eventAgeMs', () => {
  it('returns correct ms relative to now', () => {
    const now = Date.parse('2026-05-20T12:00:00.000Z');
    const event = makeEvent({ occurredAt: '2026-05-20T11:59:30.000Z' });
    expect(eventAgeMs(event, now)).toBe(30_000);
  });

  it('clamps negative skew (future occurredAt) to 0', () => {
    const now = Date.parse('2026-05-20T12:00:00.000Z');
    const future = makeEvent({ occurredAt: '2026-05-20T12:00:05.000Z' });
    expect(eventAgeMs(future, now)).toBe(0);
  });

  it('returns 0 when occurredAt is missing', () => {
    const event = makeEvent();
    delete (event as { occurredAt?: string }).occurredAt;
    expect(eventAgeMs(event)).toBe(0);
  });

  it('returns 0 when occurredAt is unparseable', () => {
    const event = makeEvent({ occurredAt: 'not-a-date' });
    expect(eventAgeMs(event)).toBe(0);
  });

  it('defaults `now` to Date.now()', () => {
    const event = makeEvent({ occurredAt: new Date(Date.now() - 1000).toISOString() });
    const age = eventAgeMs(event);
    expect(age).toBeGreaterThanOrEqual(1000);
    expect(age).toBeLessThan(2000);
  });
});

describe('isStale', () => {
  const policy: StalenessPolicy = { maxAgeMs: 60_000, onStale: 'skip' };

  it('true when age > maxAgeMs', () => {
    const event = makeEvent({ occurredAt: new Date(Date.now() - 120_000).toISOString() });
    expect(isStale(event, policy)).toBe(true);
  });

  it('false when age <= maxAgeMs', () => {
    const event = makeEvent({ occurredAt: new Date(Date.now() - 30_000).toISOString() });
    expect(isStale(event, policy)).toBe(false);
  });

  it('false when maxAgeMs is Infinity', () => {
    const ancient = makeEvent({ occurredAt: '1970-01-01T00:00:00.000Z' });
    expect(isStale(ancient, { maxAgeMs: Infinity, onStale: 'skip' })).toBe(false);
  });
});
