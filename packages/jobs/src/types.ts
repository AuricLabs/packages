export const jobStatus = {
  pending: 'pending',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
} as const;

export type JobStatus = (typeof jobStatus)[keyof typeof jobStatus];

export interface JobMessage {
  jobId: string;
  queue: string;
  attempt: number;
}

export interface JobResponse {
  success?: boolean;
  error?: unknown;
  data?: unknown;
}
