import { logger } from '@auriclabs/logger';

import { getJobAttemptService } from '../init';
import { jobStatus } from '../types';

import { StartJobContext } from './start-job';

export interface JobContinuationOptions {
  scheduledAt?: string;
  response?: unknown;
}

/**
 * Returned from an executor to complete the current attempt and immediately
 * schedule a follow-up attempt carrying `state` — the cursor for the next
 * slice of a long-running job. The job keeps its id and goes running -> pending
 * without ever reporting a false `completed` to status pollers.
 */
export class JobContinuation {
  constructor(
    public readonly state: unknown,
    public readonly options?: JobContinuationOptions,
  ) {}
}

export function continueJob(state: unknown, options?: JobContinuationOptions): JobContinuation {
  return new JobContinuation(state, options);
}

export const applyContinuation = async (
  { job, jobAttempt }: Pick<StartJobContext, 'job' | 'jobAttempt'>,
  continuation: JobContinuation,
): Promise<void> => {
  const jobAttemptService = getJobAttemptService();
  const completedAt = new Date().toISOString();

  if (!jobAttempt.startedAt) {
    throw new Error('Job attempt has no startedAt');
  }

  const duration = new Date(completedAt).getTime() - new Date(jobAttempt.startedAt).getTime();

  const nextAttempt = await jobAttemptService.continueJobAttempt(
    job.id,
    jobAttempt.attempt,
    {
      duration,
      completedAt,
      response: continuation.options?.response,
    },
    {
      state: continuation.state,
      scheduledAt: continuation.options?.scheduledAt,
    },
  );

  logger.info(
    { jobId: job.id, attempt: jobAttempt.attempt, nextAttempt: nextAttempt.attempt },
    `job ${job.id} continued to attempt ${nextAttempt.attempt} in ${duration}ms`,
  );

  Object.assign(job, { status: jobStatus.pending });
  Object.assign(jobAttempt, {
    status: jobStatus.completed,
    completedAt,
    duration,
    response: continuation.options?.response,
  });
};
