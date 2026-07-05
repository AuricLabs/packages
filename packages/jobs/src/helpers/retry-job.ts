import { logger } from '@auriclabs/logger';
import { NotFoundError } from 'http-errors-enhanced';

import { getJobAttemptService, getJobService } from '../init';

export const retryJob = async (jobId: string, scheduledAt?: string) => {
  const jobService = getJobService();
  const jobAttemptService = getJobAttemptService();

  // carry the last attempt's continuation state so a failed slice of a
  // long-running job resumes from its cursor instead of restarting
  const job = await jobService.getJob(jobId);
  const lastAttempt = job.totalAttempts
    ? await jobAttemptService.getJobAttempt(jobId, job.totalAttempts).catch((error: unknown) => {
        // a dangling totalAttempts (interrupted continuation) is expected;
        // anything else should surface rather than silently drop the cursor
        if (error instanceof NotFoundError) {
          return undefined;
        }
        throw error;
      })
    : undefined;

  const jobAttempt = await jobAttemptService.scheduleJobAttempt(
    jobId,
    scheduledAt,
    lastAttempt?.state,
  );
  logger.info({ jobId, attempt: jobAttempt.attempt }, `Job ${jobId} retry scheduled`);
  return { jobAttempt };
};
