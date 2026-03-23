vi.mock('@auriclabs/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const mockJobAttemptService = {
  updateJobAttempt: vi.fn(),
};

vi.mock('../init', () => ({
  getJobAttemptService: () => mockJobAttemptService,
}));

import { jobStatus } from '../types';

import { stopJob } from './stop-job';

describe('stopJob', () => {
  const baseJob = { id: 'job-1', status: jobStatus.running } as any;
  const baseAttempt = {
    jobId: 'job-1',
    attempt: 1,
    startedAt: '2025-01-01T00:00:00.000Z',
    status: jobStatus.running,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records success completion', async () => {
    mockJobAttemptService.updateJobAttempt.mockResolvedValue(undefined);

    const result = await stopJob(
      { job: baseJob, jobAttempt: baseAttempt },
      { success: true, data: { result: 'ok' } },
    );

    expect(result.success).toBe(true);
    expect(result.job.status).toBe(jobStatus.completed);
    expect(mockJobAttemptService.updateJobAttempt).toHaveBeenCalledWith(
      'job-1',
      1,
      expect.objectContaining({
        status: jobStatus.completed,
        duration: expect.any(Number),
        response: { result: 'ok' },
        completedAt: expect.any(String),
      }),
    );
  });

  it('records failure with error', async () => {
    mockJobAttemptService.updateJobAttempt.mockResolvedValue(undefined);

    const result = await stopJob(
      { job: { ...baseJob }, jobAttempt: { ...baseAttempt } },
      { success: false, error: 'something went wrong' },
    );

    expect(result.success).toBe(true);
    expect(result.job.status).toBe(jobStatus.failed);
    expect(mockJobAttemptService.updateJobAttempt).toHaveBeenCalledWith(
      'job-1',
      1,
      expect.objectContaining({
        status: jobStatus.failed,
        error: 'something went wrong',
        failedAt: expect.any(String),
        duration: expect.any(Number),
      }),
    );
  });

  it('records failure with Error object', async () => {
    mockJobAttemptService.updateJobAttempt.mockResolvedValue(undefined);
    const err = new Error('test error');

    const result = await stopJob(
      { job: { ...baseJob }, jobAttempt: { ...baseAttempt } },
      { success: false, error: err },
    );

    expect(result.success).toBe(true);
    expect(mockJobAttemptService.updateJobAttempt).toHaveBeenCalledWith(
      'job-1',
      1,
      expect.objectContaining({
        error: err.stack,
      }),
    );
  });

  it('throws when no startedAt', async () => {
    const attemptNoStart = { ...baseAttempt, startedAt: undefined };

    await expect(
      stopJob({ job: baseJob, jobAttempt: attemptNoStart }, { success: true }),
    ).rejects.toThrow('Job attempt has no startedAt');
  });

  it('returns success false when updateJobAttempt throws', async () => {
    mockJobAttemptService.updateJobAttempt.mockRejectedValue(new Error('update failed'));

    const result = await stopJob(
      { job: { ...baseJob }, jobAttempt: { ...baseAttempt } },
      { success: true },
    );

    expect(result.success).toBe(false);
  });

  it('infers success when response has no success or error field', async () => {
    mockJobAttemptService.updateJobAttempt.mockResolvedValue(undefined);

    const result = await stopJob(
      { job: { ...baseJob }, jobAttempt: { ...baseAttempt } },
      { data: { info: 'some data' } },
    );

    expect(result.success).toBe(true);
    expect(result.job.status).toBe(jobStatus.completed);
  });

  it('infers failure when response has error but no success field', async () => {
    mockJobAttemptService.updateJobAttempt.mockResolvedValue(undefined);

    const result = await stopJob(
      { job: { ...baseJob }, jobAttempt: { ...baseAttempt } },
      { error: 'failed' },
    );

    expect(result.success).toBe(true);
    expect(result.job.status).toBe(jobStatus.failed);
  });
});
