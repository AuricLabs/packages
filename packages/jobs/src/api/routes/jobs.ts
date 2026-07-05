import { getJobAttemptService, getJobService } from '../../init';
import { JobAttemptItem, JobItem } from '../../models';
import { JobSummary } from '../../services';
import { jobStatus, JobStatus } from '../../types';

export interface ListJobsResult {
  jobs: JobItem[];
  cursor: string | null;
}

export interface JobDetailResult {
  job: JobItem;
  attempts: JobAttemptItem[];
}

export function isJobStatus(value: string): value is JobStatus {
  return Object.values(jobStatus).includes(value as JobStatus);
}

export async function getJobs(options: {
  status?: JobStatus;
  limit?: number;
}): Promise<ListJobsResult> {
  const jobService = getJobService();

  if (options.status) {
    const { data, cursor } = await jobService.listJobsByStatus(options.status, {
      limit: options.limit,
    });
    return { jobs: data, cursor };
  }

  const jobs = await jobService.listJobs({ limit: options.limit });
  return { jobs, cursor: null };
}

export async function getJobsSummary(): Promise<JobSummary> {
  return getJobService().getJobSummary();
}

export async function getJobById(jobId: string): Promise<JobDetailResult> {
  const jobService = getJobService();
  const jobAttemptService = getJobAttemptService();

  const job = await jobService.getJob(jobId);
  const { data: attempts } = await jobAttemptService.getAllJobAttempts(jobId, {
    pages: 'all',
    order: 'desc',
  });

  return { job, attempts };
}
