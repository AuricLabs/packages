import { executeJob, JobContinuation, StartJobContext } from '../helpers';
import { getJobService } from '../init';
import { JobResponse } from '../types';

import { createSqsJobConsumer } from './sqs-job-consumer';

export type RegistryJobHandler = (payload: never, context: StartJobContext) => unknown;

export type RegistryHandlerMap = Record<string, RegistryJobHandler>;

/**
 * In-process alternative to createLambdaExecutorHandler: instead of invoking a
 * target Lambda per job fn, runs a registered handler inside the consumer.
 * Handlers return raw data (wrapped as a success response), a JobContinuation
 * to schedule the next slice of a long-running job, or throw to fail the
 * attempt.
 */
export function createRegistryExecutorHandler(handlers: RegistryHandlerMap) {
  return createSqsJobConsumer(async (message) => {
    const jobService = getJobService();
    const job = await jobService.getJob(message.jobId);

    await executeJob(message, async (context) => {
      const handler = (handlers as Partial<RegistryHandlerMap>)[job.fn];
      if (!handler) {
        throw new Error(`No handler registered for job fn "${job.fn}"`);
      }

      const result = await handler(job.payload as never, context);

      if (result instanceof JobContinuation) {
        return result;
      }
      if (result === undefined) {
        return { success: true } satisfies JobResponse;
      }
      return { success: true, data: result } satisfies JobResponse;
    });
  });
}
