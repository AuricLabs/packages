import { getJobService, getJobAttemptService } from '../init';

export const getJobContext = async (jobId: string, attempt: number) => {
  const jobService = getJobService();
  const jobAttemptService = getJobAttemptService();

  const job = await jobService.getJob(jobId);
  const jobAttempt = await jobAttemptService.getJobAttempt(jobId, attempt);
  return { job, jobAttempt };
};
