import { logger } from '@auriclabs/logger';
import { SQSBatchResponse, SQSEvent } from 'aws-lambda';

import { setEventContext } from './context';
import { EventHandlers, EventRecord } from './types';

export interface CreateEventListenerOptions {
  debug?: boolean;
}

export const createEventListener =
  (eventHandlers: EventHandlers, { debug = false }: CreateEventListenerOptions = {}) =>
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
