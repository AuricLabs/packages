import { normalizePaginationResponse, PaginationResponse } from '@auriclabs/pagination';
import { DynamoDBClient, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

import type {
  EventRecord,
  AggregateHead,
  AggregatePK,
  EventId,
  AggregateId,
  AggregateType,
  EventSK,
  Source,
} from './types';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient(), {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const pad = (n: number, w = 9): EventId => String(n).padStart(w, '0') as EventId;
const pkFor = (aggregateType: string, aggregateId: string): AggregatePK =>
  `AGG#${aggregateType}#${aggregateId}`;

export interface AppendArgs<P = unknown> {
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  source: string;
  /** Version you observed before appending (0 for brand new) */
  expectedVersion: number;
  /** Required for idempotent retries (e.g., the command id) */
  idempotencyKey: string;

  // Event properties (flattened)
  eventId: string; // ULID/UUID – must be stable across retries
  eventType: string;
  occurredAt?: string; // default: now ISO
  payload?: Readonly<P>;
  schemaVersion?: number; // optional but recommended

  // Optional metadata
  correlationId?: string;
  causationId?: string;
  actorId?: string;
}

export interface AppendEventResult {
  pk: string;
  sk: string;
  version: number;
}

export interface EventService {
  appendEvent<P = unknown>(args: AppendArgs<P>): Promise<AppendEventResult>;
  getHead(aggregateType: string, aggregateId: string): Promise<AggregateHead | undefined>;
  getEvent(
    aggregateType: string,
    aggregateId: string,
    version: number,
  ): Promise<EventRecord | undefined>;
  listEvents(params: {
    aggregateType: string;
    aggregateId: string;
    fromVersionExclusive?: number;
    toVersionInclusive?: number;
    limit?: number;
  }): Promise<PaginationResponse<EventRecord>>;
}

export function createEventService(tableName: string): EventService {
  const TABLE = tableName;

  return {
    async appendEvent<P = unknown>(args: AppendArgs<P>): Promise<AppendEventResult> {
      const {
        tenantId,
        aggregateType,
        aggregateId,
        expectedVersion,
        idempotencyKey,
        eventId,
        eventType,
        occurredAt,
        source,
        payload,
        schemaVersion,
        correlationId,
        causationId,
        actorId,
      } = args;

      const pk = pkFor(aggregateType, aggregateId);
      const nextVersion = expectedVersion + 1;
      const sk = `EVT#${pad(nextVersion)}` as EventSK;
      const nowIso = new Date().toISOString();
      const eventOccurredAt = occurredAt ?? nowIso;

      try {
        await ddb.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Update: {
                  TableName: TABLE,
                  Key: { pk, sk: 'HEAD' },
                  UpdateExpression:
                    'SET currentVersion = :next, lastEventId = :eid, lastIdemKey = :idem, updatedAt = :now, aggregateId = if_not_exists(aggregateId, :aid), aggregateType = if_not_exists(aggregateType, :atype)',
                  ConditionExpression:
                    '(attribute_not_exists(currentVersion) AND :expected = :zero) ' +
                    'OR currentVersion = :expected ' +
                    'OR lastIdemKey = :idem',
                  ExpressionAttributeValues: {
                    ':zero': 0,
                    ':expected': expectedVersion,
                    ':next': nextVersion,
                    ':eid': eventId,
                    ':idem': idempotencyKey,
                    ':now': nowIso,
                    ':aid': aggregateId,
                    ':atype': aggregateType,
                  },
                },
              },
              {
                Put: {
                  TableName: TABLE,
                  // NOTE: `EventRecord.meta` is intentionally NOT written here.
                  // `meta` is a wire-only field (set by recovery scripts on
                  // republished SQS bodies, or mutated in place by the
                  // listener under `process-degraded`). The persisted source
                  // row stays meta-free so `meta.replay` / `meta.isStale` can
                  // never accidentally leak into the canonical event store.
                  Item: {
                    pk,
                    sk,
                    itemType: 'event',
                    source: source as Source,
                    aggregateId: aggregateId as AggregateId,
                    aggregateType: aggregateType as AggregateType,
                    version: nextVersion,

                    tenantId,

                    eventId: eventId as EventId,
                    eventType: eventType,
                    schemaVersion: schemaVersion ?? 1,
                    occurredAt: eventOccurredAt,

                    correlationId,
                    causationId,
                    actorId,

                    payload: payload as Readonly<unknown>,
                  } satisfies EventRecord,
                  ConditionExpression: 'attribute_not_exists(pk) OR eventId = :eid',
                  ExpressionAttributeValues: { ':eid': eventId },
                },
              },
            ],
          }),
        );
      } catch (err) {
        if (err instanceof ConditionalCheckFailedException) {
          throw new Error(
            `OCC failed for aggregate ${aggregateType}/${aggregateId}: expectedVersion=${expectedVersion}`,
          );
        }
        throw err;
      }

      return { pk, sk, version: nextVersion };
    },

    async getHead(aggregateType: string, aggregateId: string): Promise<AggregateHead | undefined> {
      const pk = pkFor(aggregateType, aggregateId);
      const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk, sk: 'HEAD' } }));
      return res.Item as AggregateHead | undefined;
    },

    async getEvent(
      aggregateType: string,
      aggregateId: string,
      version: number,
    ): Promise<EventRecord | undefined> {
      const pk = pkFor(aggregateType, aggregateId);
      const sk = `EVT#${pad(version)}`;
      const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk, sk } }));
      return res.Item as EventRecord | undefined;
    },

    async listEvents(params: {
      aggregateType: string;
      aggregateId: string;
      fromVersionExclusive?: number;
      toVersionInclusive?: number;
      limit?: number;
    }): Promise<PaginationResponse<EventRecord>> {
      const pk = pkFor(params.aggregateType, params.aggregateId);
      const fromSk =
        params.fromVersionExclusive != null
          ? `EVT#${pad(params.fromVersionExclusive + 1)}`
          : 'EVT#000000000';
      const toSk =
        params.toVersionInclusive != null
          ? `EVT#${pad(params.toVersionInclusive)}`
          : 'EVT#999999999';

      const res = await ddb.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
          ExpressionAttributeValues: {
            ':pk': pk,
            ':from': fromSk,
            ':to': toSk,
          },
          ScanIndexForward: true,
          Limit: params.limit,
        }),
      );

      return normalizePaginationResponse({
        data: (res.Items ?? []) as EventRecord[],
        cursor: res.LastEvaluatedKey && (res.LastEvaluatedKey as { pk: string; sk: string }).sk,
      });
    },
  };
}
