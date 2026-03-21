import { logger } from '@auriclabs/logger';

import { getJobAttemptService } from '../init';
import { JobAttemptItem, JobItem } from '../models';
import { JobResponse, jobStatus } from '../types';

import { StartJobContext } from './start-job';

export interface StopJobContext {
  job: JobItem;
  jobAttempt: JobAttemptItem;
  success: boolean;
}

export const stopJob = async (
  { job, jobAttempt }: Pick<StartJobContext, 'job' | 'jobAttempt'>,
  response: JobResponse | undefined | null,
): Promise<StopJobContext> => {
  const jobAttemptService = getJobAttemptService();
  const completedAt = new Date().toISOString();

  if (!jobAttempt.startedAt) {
    throw new Error('Job attempt has no startedAt');
  }

  const success = response?.success ?? !response?.error;
  const duration = new Date(completedAt).getTime() - new Date(jobAttempt.startedAt).getTime();

  logger.info(
    { jobId: job.id, response, attempt: jobAttempt.attempt },
    `job ${job.id} completed as ${success ? 'success' : 'failed'} in ${duration}ms`,
  );

  try {
    if (success) {
      await jobAttemptService.updateJobAttempt(job.id, jobAttempt.attempt, {
        status: jobStatus.completed,
        duration,
        response: response?.data,
        completedAt,
      });
    } else {
      await jobAttemptService.updateJobAttempt(job.id, jobAttempt.attempt, {
        status: jobStatus.failed,
        error: response?.error instanceof Error ? response.error.stack : String(response?.error),
        response: response?.data,
        failedAt: completedAt,
        duration,
      });
    }
  } catch (error) {
    logger.error({ error }, 'failed to update job attempt');
    return {
      job,
      jobAttempt,
      success: false,
    };
  }

  Object.assign(job, { status: success ? jobStatus.completed : jobStatus.failed });
  Object.assign(jobAttempt, {
    status: success ? jobStatus.completed : jobStatus.failed,
    completedAt,
    duration,
    response: response?.data,
    error:
      response?.error instanceof Error
        ? response.error.stack
        : success
          ? undefined
          : String(response?.error),
  });

  return {
    job,
    jobAttempt,
    success: true,
  };
};
