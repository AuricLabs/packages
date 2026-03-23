import { logger } from '@auriclabs/logger';

import { getJobService, getJobAttemptService, getJobQueueService } from '../init';
import { JobAttemptItem, JobItem } from '../models';
import { JobMessage, jobStatus } from '../types';

export interface StartJobContext {
  job: JobItem;
  jobAttempt: JobAttemptItem;
  success: boolean;
}

export const startJob = async ({ jobId, attempt, queue }: JobMessage): Promise<StartJobContext> => {
  const jobService = getJobService();
  const jobAttemptService = getJobAttemptService();
  const jobQueueService = getJobQueueService();

  const jobAttempt = await jobAttemptService.getJobAttempt(jobId, attempt);
  const job = await jobService.getJob(jobId);

  logger.debug({ jobAttempt, job }, 'Received job attempt');
  if (jobAttempt.scheduledAt && new Date(jobAttempt.scheduledAt).getTime() > Date.now()) {
    logger.info({ jobId }, 'job is scheduled, re-adding to queue');
    await jobQueueService.addToQueue(queue, jobId, attempt, jobAttempt.scheduledAt);
    return {
      job,
      jobAttempt,
      success: false,
    };
  }

  const startedAt = await jobAttemptService.markJobAttemptAsRunning(jobId, attempt);

  if (!startedAt) {
    logger.info({ jobId }, 'job is not pending, skipping');
    return {
      job,
      jobAttempt,
      success: false,
    };
  }

  Object.assign(job, { status: jobStatus.running });
  Object.assign(jobAttempt, { startedAt, status: jobStatus.running });

  return {
    job,
    jobAttempt,
    success: true,
  };
};
