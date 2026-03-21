import { retry } from '@auriclabs/api-core';
import { logger } from '@auriclabs/logger';
import { ulid } from 'ulid';

import { AppendArgs, AppendEventResult } from './event-service';
import { getEventService } from './init';
import { getEventContext } from './context';

export type DispatchEventArgs = Omit<
  AppendArgs,
  'eventId' | 'expectedVersion' | 'schemaVersion' | 'occurredAt' | 'idempotencyKey'
> &
  Partial<Pick<AppendArgs, 'idempotencyKey' | 'eventId'>>;

export const dispatchEvent = async (event: DispatchEventArgs): Promise<AppendEventResult> => {
  const eventService = getEventService();
  const eventId = event.eventId ?? `evt-${ulid()}`;
  const occurredAt = new Date().toISOString();
  const idempotencyKey = event.idempotencyKey ?? eventId;

  return retry(async () => {
    const head = await eventService.getHead(event.aggregateType, event.aggregateId);
    logger.debug({ event }, 'Dispatching event');
    return eventService.appendEvent({
      ...getEventContext(),
      ...event,
      eventId,
      expectedVersion: head?.currentVersion ?? 0,
      schemaVersion: 1,
      occurredAt,
      idempotencyKey,
    });
  });
};
