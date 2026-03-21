import { ulid } from 'ulid';

import { EventContext, getEventContext } from './context';
import { dispatchEvent, DispatchEventArgs } from './dispatch-event';
import { AppendEventResult } from './event-service';

export type MakePartial<T, O> = Omit<T, keyof O> & Partial<O>;

export type DispatchRecord<
  Options extends Partial<DispatchEventArgs> = Partial<DispatchEventArgs>,
> = Record<
  string,
  (
    ...args: any[]
  ) =>
    | ValueOrFactoryRecord<MakePartial<DispatchEventArgs, Options>>
    | DispatchEventArgsFactory<Options>
>;

export type ValueOrFactory<T> = T | ((context: EventContext) => T);
export type ValueOrFactoryRecord<T> = {
  [K in keyof T]: ValueOrFactory<T[K]>;
};

export type DispatchEventArgsFactory<Options extends Partial<DispatchEventArgs>> = (
  context: EventContext,
) => MakePartial<DispatchEventArgs, Options>;

export type DispatchRecordResponse<
  R extends DispatchRecord<O>,
  O extends Partial<DispatchEventArgs>,
> = {
  [K in keyof R]: (...args: Parameters<R[K]>) => Promise<AppendEventResult>;
};

export function createDispatch<DR extends DispatchRecord<O>, O extends Partial<DispatchEventArgs>>(
  record: DR,
  optionsOrFactory?: ValueOrFactoryRecord<O> | ((context: EventContext) => O),
): DispatchRecordResponse<DR, O> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (...args: any[]) => {
        const eventId = `evt-${ulid()}`;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const result = value(...args);
        const context: EventContext = { eventId, ...getEventContext() };
        const executeValueFn = (value: any) =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
          typeof value === 'function' ? value(context) : value;
        const parseResponse = (result: any) =>
          Object.fromEntries(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            Object.entries(result).map(([key, value]) => [key, executeValueFn(value)]),
          );
        Object.assign(
          context,
          typeof result === 'function' ? result(context) : parseResponse(result),
        );
        Object.assign(
          context,
          typeof optionsOrFactory === 'function'
            ? optionsOrFactory(context)
            : parseResponse(optionsOrFactory),
        );
        return dispatchEvent(context as DispatchEventArgs);
      },
    ]),
  ) as DispatchRecordResponse<DR, O>;
}
