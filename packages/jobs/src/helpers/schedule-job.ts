import { logger } from '@auriclabs/logger';

import { getJobService, getJobAttemptService } from '../init';

export const scheduleJob = async (
  queue: string,
  fn: string,
  payload: unknown,
  scheduledAt?: string,
) => {
  const jobService = getJobService();
  const jobAttemptService = getJobAttemptService();

  const job = await jobService.createJob({
    fn,
    queue,
    payload,
  });
  logger.debug({ jobId: job.id, fn }, `Job ${job.id} created`);
  const jobAttempt = await jobAttemptService.scheduleJobAttempt(job.id, scheduledAt);
  logger.info({ jobId: job.id, attempt: jobAttempt.attempt, fn }, `Job ${job.id} scheduled`);
  return { job, jobAttempt };
};
