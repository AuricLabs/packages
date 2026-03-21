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
    let hasFailed = false;
    for (const record of sqsEvent.Records) {
      // skip the job if it has failed
      if (hasFailed) {
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
        hasFailed = true;
        logger.error({ error, event, body: record.body }, 'Error processing event');
        response.batchItemFailures.push({
          itemIdentifier: record.messageId,
        });
      }
    }
    return response;
  };
