import { createRegistryExecutorHandler, RegistryHandlerMap } from '../handlers';
import { scheduleJob, StartJobContext } from '../helpers';

/** Return raw data (wrapped as success), a JobContinuation, or throw to fail. */
export type JobHandler<TPayload> = (payload: TPayload, context: StartJobContext) => unknown;

export type JobHandlerMap<TJobs extends object> = {
  [K in keyof TJobs]: JobHandler<TJobs[K]>;
};

export interface TypedJobs<TJobs extends object> {
  scheduleJob<K extends keyof TJobs & string>(
    queue: string,
    fn: K,
    payload: TJobs[K],
    scheduledAt?: string,
  ): ReturnType<typeof scheduleJob>;
  /** Identity inference anchor — the mapped type enforces exhaustive, correctly-typed handlers. */
  defineHandlers(handlers: JobHandlerMap<TJobs>): JobHandlerMap<TJobs>;
  createRegistryExecutorHandler(
    handlers: JobHandlerMap<TJobs>,
  ): ReturnType<typeof createRegistryExecutorHandler>;
}

/**
 * Compile-time-safe layer over the untyped job core. Consumers declare a map
 * of job fn -> payload type once and get typed scheduling plus exhaustive
 * handler dispatch:
 *
 *   interface MyJobs {
 *     syncItems: { cursor?: string };
 *     cloneItem: { itemId: string };
 *   }
 *   export const jobs = defineJobs<MyJobs>();
 *   await jobs.scheduleJob('worker', 'cloneItem', { itemId: 'x' });
 *   export const handler = jobs.createRegistryExecutorHandler({
 *     syncItems: async (payload) => { ... },
 *     cloneItem: async (payload) => ({ clonedId: ... }),
 *   });
 */
export function defineJobs<TJobs extends object>(): TypedJobs<TJobs> {
  return {
    scheduleJob(queue, fn, payload, scheduledAt) {
      return scheduleJob(queue, fn, payload, scheduledAt);
    },
    defineHandlers(handlers) {
      return handlers;
    },
    createRegistryExecutorHandler(handlers) {
      return createRegistryExecutorHandler(handlers as unknown as RegistryHandlerMap);
    },
  };
}
