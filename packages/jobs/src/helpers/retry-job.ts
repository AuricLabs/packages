import { logger } from '@auriclabs/logger';

import { getJobAttemptService, getJobService } from '../init';

export const retryJob = async (jobId: string, scheduledAt?: string) => {
  const jobService = getJobService();
  const jobAttemptService = getJobAttemptService();

  // carry the last attempt's continuation state so a failed slice of a
  // long-running job resumes from its cursor instead of restarting
  const job = await jobService.getJob(jobId);
  const lastAttempt = job.totalAttempts
    ? await jobAttemptService.getJobAttempt(jobId, job.totalAttempts).catch(() => undefined)
    : undefined;

  const jobAttempt = await jobAttemptService.scheduleJobAttempt(
    jobId,
    scheduledAt,
    lastAttempt?.state,
  );
  logger.info({ jobId, attempt: jobAttempt.attempt }, `Job ${jobId} retry scheduled`);
  return { jobAttempt };
};
