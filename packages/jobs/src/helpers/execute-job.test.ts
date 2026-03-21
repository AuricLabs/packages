vi.mock('@auriclabs/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const mockStartJob = vi.fn();
const mockStopJob = vi.fn();

vi.mock('./start-job', () => ({
  startJob: (...args: unknown[]) => mockStartJob(...args),
}));

vi.mock('./stop-job', () => ({
  stopJob: (...args: unknown[]) => mockStopJob(...args),
}));

import { jobStatus } from '../types';
import { executeJob, JobExecutionError } from './execute-job';

describe('executeJob', () => {
  const baseMessage = { jobId: 'job-1', attempt: 1, queue: 'lambda' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs full success lifecycle', async () => {
    const context = {
      job: { id: 'job-1', status: jobStatus.running },
      jobAttempt: { jobId: 'job-1', attempt: 1, startedAt: '2025-01-01T00:00:00Z' },
      success: true,
    };
    const response = { success: true, data: { result: 'ok' } };

    mockStartJob.mockResolvedValue(context);
    const executor = vi.fn().mockResolvedValue(response);
    mockStopJob.mockResolvedValue({ success: true });

    await executeJob(baseMessage, executor);

    expect(mockStartJob).toHaveBeenCalledWith(baseMessage);
    expect(executor).toHaveBeenCalledWith(context);
    expect(mockStopJob).toHaveBeenCalledWith(context, response);
  });

  it('returns early when start is not successful', async () => {
    const context = {
      job: { id: 'job-1' },
      jobAttempt: { jobId: 'job-1', attempt: 1 },
      success: false,
    };

    mockStartJob.mockResolvedValue(context);
    const executor = vi.fn();

    await executeJob(baseMessage, executor);

    expect(executor).not.toHaveBeenCalled();
    expect(mockStopJob).not.toHaveBeenCalled();
  });

  it('handles executor failure with started context', async () => {
    const context = {
      job: { id: 'job-1', status: jobStatus.running },
      jobAttempt: { jobId: 'job-1', attempt: 1, startedAt: '2025-01-01T00:00:00Z' },
      success: true,
    };

    mockStartJob.mockResolvedValue(context);
    const error = new Error('executor failed');
    const executor = vi.fn().mockRejectedValue(error);
    mockStopJob.mockResolvedValue({ success: false });

    await expect(executeJob(baseMessage, executor)).rejects.toThrow(JobExecutionError);

    expect(mockStopJob).toHaveBeenCalledWith(context, { success: false, error });
  });

  it('handles executor failure without started context (startJob throws)', async () => {
    const error = new Error('start failed');
    mockStartJob.mockRejectedValue(error);
    const executor = vi.fn();

    await expect(executeJob(baseMessage, executor)).rejects.toThrow(JobExecutionError);

    // stopJob should not have been called since context is undefined
    expect(mockStopJob).not.toHaveBeenCalled();
  });

  it('handles stopJob throwing during error handling', async () => {
    const context = {
      job: { id: 'job-1', status: jobStatus.running },
      jobAttempt: { jobId: 'job-1', attempt: 1, startedAt: '2025-01-01T00:00:00Z' },
      success: true,
    };

    mockStartJob.mockResolvedValue(context);
    const executorError = new Error('executor failed');
    const executor = vi.fn().mockRejectedValue(executorError);
    mockStopJob.mockRejectedValue(new Error('stop also failed'));

    await expect(executeJob(baseMessage, executor)).rejects.toThrow(JobExecutionError);
  });
});

describe('JobExecutionError', () => {
  it('has correct properties', () => {
    const originalError = new Error('original');
    const job = { id: 'job-1', status: jobStatus.running } as any;
    const jobAttempt = { jobId: 'job-1', attempt: 1 } as any;
    const response = { success: false, error: 'failed' };

    const error = new JobExecutionError(originalError, job, jobAttempt, response);

    expect(error.name).toBe('JobExecutionError');
    expect(error.message).toBe('original');
    expect(error.originalError).toBe(originalError);
    expect(error.job).toBe(job);
    expect(error.jobAttempt).toBe(jobAttempt);
    expect(error.response).toBe(response);
    expect(error.started).toBe(true);
    expect(error.completed).toBe(false);
  });

  it('started is false when job is not running', () => {
    const error = new JobExecutionError(
      'error',
      { status: jobStatus.pending } as any,
    );
    expect(error.started).toBe(false);
  });

  it('completed is true when job is completed', () => {
    const error = new JobExecutionError(
      'error',
      { status: jobStatus.completed } as any,
    );
    expect(error.completed).toBe(true);
  });

  it('started and completed are false when no job', () => {
    const error = new JobExecutionError('error');
    expect(error.started).toBe(false);
    expect(error.completed).toBe(false);
  });

  it('handles non-Error originalError', () => {
    const error = new JobExecutionError('string error');
    expect(error.message).toBe('string error');
  });
});
