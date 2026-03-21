import { createEventService, EventService } from './event-service';

let _eventService: EventService | undefined;

export function initEvents(config: { tableName: string }): void {
  _eventService = createEventService(config.tableName);
}

export function getEventService(): EventService {
  if (!_eventService) {
    throw new Error('Call initEvents() before using events');
  }
  return _eventService;
}
