import { dispatchEvent, DispatchEventArgs } from './dispatch-event';

export interface DispatchEventsArgs {
  inOrder?: boolean;
}

export const dispatchEvents = async (
  events: DispatchEventArgs[],
  { inOrder = false }: DispatchEventsArgs = {},
) => {
  if (inOrder) {
    for (const event of events) {
      await dispatchEvent(event);
    }
  } else {
    await Promise.all(events.map((event) => dispatchEvent(event)));
  }
};
