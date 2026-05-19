import { logger } from '@auriclabs/logger';
import { SQSBatchResponse, SQSEvent } from 'aws-lambda';

import { setEventContext } from './context';
import { DEFAULT_POLICY, eventAgeMs, isStale, StalenessPolicy } from './staleness';
import { EventHandlers, EventRecord } from './types';

export interface CreateEventListenerOptions {
  debug?: boolean;
  /**
   * Default staleness policy applied to every event whose `eventType` does not
   * have a more specific override in `stalenessByEventType`. Defaults to
   * {@link DEFAULT_POLICY} (no check, process normally).
   */
  staleness?: StalenessPolicy;
  /**
   * Per-event-type staleness overrides. Lookup happens by `event.eventType`;
   * a hit here beats `staleness`.
   */
  stalenessByEventType?: Record<string, StalenessPolicy>;
}

export const createEventListener =
  (
    eventHandlers: EventHandlers,
    {
      debug = false,
      staleness = DEFAULT_POLICY,
      stalenessByEventType = {},
    }: CreateEventListenerOptions = {},
  ) =>
  async (sqsEvent: SQSEvent) => {
    const response: SQSBatchResponse = {
      batchItemFailures: [],
    };
    const failedGroups = new Set<string>();
    for (const record of sqsEvent.Records) {
      const groupId = record.attributes?.MessageGroupId;

      // Skip records whose message group already failed (preserves FIFO ordering per aggregate)
      if (groupId && failedGroups.has(groupId)) {
        response.batchItemFailures.push({
          itemIdentifier: record.messageId,
        });
        continue;
      }

      let event: EventRecord | undefined;
      try {
        event = JSON.parse(record.body) as EventRecord;
        if (debug) {
          logger.debug({ event }, 'Processing event');
        }

        const policy = stalenessByEventType[event.eventType] ?? staleness;
        if (isStale(event, policy)) {
          if (policy.onStale === 'skip') {
            // Ack the message but do not invoke the handler.
            // Intentionally does NOT add to `failedGroups` — a stale-skip is
            // not a failure, and we want subsequent same-group records to be
            // evaluated independently (each gets its own staleness check).
            logger.info(
              {
                eventId: event.eventId,
                eventType: event.eventType,
                aggregateId: event.aggregateId,
                aggregateType: event.aggregateType,
                ageMs: eventAgeMs(event),
                maxAgeMs: policy.maxAgeMs,
              },
              'Skipping stale event',
            );
            continue;
          }
          if (policy.onStale === 'process-degraded') {
            event.meta = {
              ...event.meta,
              isStale: true,
              ageMs: eventAgeMs(event),
            };
          }
          // onStale === 'process-normally' → fall through unchanged.
        }

        let handler = eventHandlers[event.eventType];
        while (typeof handler === 'string') {
          handler = eventHandlers[handler];
        }
        if (typeof handler === 'function') {
          setEventContext({
            causationId: event.eventId,
            correlationId: event.correlationId,
            actorId: event.actorId,
          });
          await handler(event);
        }
      } catch (error) {
        if (groupId) failedGroups.add(groupId);
        logger.error({ error, event, body: record.body }, 'Error processing event');
        response.batchItemFailures.push({
          itemIdentifier: record.messageId,
        });
      }
    }
    return response;
  };
