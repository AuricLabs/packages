// helpers (optional, but nice)
export type Brand<T, B extends string> = T & { readonly __brand: B };
export type Source = Brand<string, 'Source'>;
export type AggregateId = Brand<string, 'AggregateId'>;
export type AggregateType = Brand<string, 'AggregateType'>;
export type EventId = Brand<string, 'EventId'>; // ULID/UUID

// If you use prefixed keys like AGG#wallet#wal_123 and EVT#000000042:
export type AggregatePK = `AGG#${string}#${string}`;
export type EventSK = `EVT#${string}` | 'HEAD';
export type ItemType = 'event' | 'head';

// ---------- Event item ----------
export interface EventRecord<P = unknown> {
  /** DynamoDB keys */
  pk: AggregatePK; // or PK if you use uppercase
  sk: EventSK; // "EVT#000000042"
  itemType: Extract<ItemType, 'event'>;

  /** Aggregate routing */
  source: Source;
  aggregateId: AggregateId;
  aggregateType: AggregateType;
  version: number; // post-apply version

  /** Tenant isolation */
  tenantId: string;

  /** Event identity & semantics */
  eventId: EventId; // string (ULID/UUID), not number
  eventType: string;
  schemaVersion?: number; // optional but recommended
  occurredAt: string; // ISO timestamp ("2025-10-01T08:12:34.567Z")

  /** Tracing (optional) */
  correlationId?: string;
  causationId?: string;
  actorId?: string;

  /** Domain payload */
  payload: Readonly<P>;
}

// ---------- HEAD (aggregate metadata) ----------
export interface AggregateHead {
  /** DynamoDB keys */
  pk: AggregatePK;
  sk: 'HEAD';
  itemType: Extract<ItemType, 'head'>;

  /** Aggregate identity */
  aggregateId: AggregateId;
  aggregateType: AggregateType;

  /** Version tracking */
  currentVersion: number;

  /** Idempotency/debug */
  lastEventId?: EventId;
  lastIdemKey?: string; // make optional; only set when you use it
  updatedAt: string; // ISO timestamp
}

export type EventHandlers = Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((event: EventRecord<any>) => Promise<void> | void) | string
>;
