import { AppendArgs } from './event-service';

export type EventContext = Partial<AppendArgs>;

let context: EventContext = {};

export const setEventContext = (newContext: EventContext) => {
  context = { ...newContext };
};

export const getEventContext = () => context;

export const resetEventContext = () => {
  context = {};
};

export const appendEventContext = (event: EventContext) => {
  context = { ...context, ...event };
};
