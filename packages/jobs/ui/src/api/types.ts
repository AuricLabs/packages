export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export const JOB_STATUSES: JobStatus[] = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
];

export interface Job {
  id: string;
  queue: string;
  fn: string;
  status: JobStatus;
  totalAttempts: number;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface JobAttempt {
  jobId: string;
  attempt: number;
  status: JobStatus;
  error?: string;
  response?: unknown;
  state?: unknown;
  duration?: number;
  startedAt?: string;
  scheduledAt?: string;
  completedAt?: string;
  failedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListJobsResponse {
  jobs: Job[];
  cursor: string | null;
}

export type JobsSummary = Record<JobStatus, number>;

export interface JobDetailResponse {
  job: Job;
  attempts: JobAttempt[];
}

export interface RetryResponse {
  retried: boolean;
  jobAttempt?: JobAttempt;
  error?: string;
}

export interface CancelResponse {
  cancelled: boolean;
  error?: string;
}

export interface StatusDisplay {
  label: string;
  className: string;
}

export function getStatusDisplay(status: JobStatus): StatusDisplay {
  switch (status) {
    case 'pending':
      return { label: 'Pending', className: 'bg-amber-500/10 text-amber-400' };
    case 'running':
      return { label: 'Running', className: 'bg-blue-500/10 text-blue-400' };
    case 'completed':
      return { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-400' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-500/10 text-red-400' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-zinc-500/10 text-zinc-400' };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
