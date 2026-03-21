export const JobErrorCodes = {
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  JOB_RUNNING: 'JOB_RUNNING',
  JOB_NOT_PENDING: 'JOB_NOT_PENDING',
} as const;

export type JobErrorCode = (typeof JobErrorCodes)[keyof typeof JobErrorCodes];
