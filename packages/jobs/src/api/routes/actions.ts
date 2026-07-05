import { retryJob } from '../../helpers';
import { getJobService } from '../../init';
import { JobAttemptItem } from '../../models';
import { jobStatus } from '../../types';

export interface RetryJobResult {
  retried: boolean;
  jobAttempt?: JobAttemptItem;
  error?: string;
}

export interface CancelJobResult {
  cancelled: boolean;
  error?: string;
}

export async function executeRetryJob(
  jobId: string,
  scheduledAt?: string,
): Promise<RetryJobResult> {
  const jobAttempt = await retryJob(jobId, scheduledAt);
  return { retried: true, jobAttempt: jobAttempt.jobAttempt };
}

export async function executeCancelJob(jobId: string): Promise<CancelJobResult> {
  const jobService = getJobService();

  // pending-only: a running attempt can't be interrupted, and completed/failed
  // jobs have nothing to cancel
  const cancelled = await jobService.updateJobStatus(jobId, jobStatus.cancelled, jobStatus.pending);

  if (!cancelled) {
    return { cancelled: false, error: 'Job is not pending' };
  }
  return { cancelled: true };
}
