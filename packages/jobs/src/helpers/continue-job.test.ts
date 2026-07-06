vi.mock('@auriclabs/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const mockJobAttemptService = {
  continueJobAttempt: vi.fn(),
};

vi.mock('../init', () => ({
  getJobAttemptService: () => mockJobAttemptService,
}));

import { JobAttemptItem, JobItem } from '../models';
import { jobStatus } from '../types';

import { applyContinuation, continueJob, JobContinuation } from './continue-job';
import { OutputBuffer } from './output-buffer';

describe('continueJob', () => {
  it('wraps state and options in a JobContinuation', () => {
    const continuation = continueJob({ cursor: 'abc' }, { scheduledAt: '2025-06-01T00:00:00Z' });

    expect(continuation).toBeInstanceOf(JobContinuation);
    expect(continuation.state).toEqual({ cursor: 'abc' });
    expect(continuation.options).toEqual({ scheduledAt: '2025-06-01T00:00:00Z' });
  });
});

describe('applyContinuation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createContext() {
    const job = { id: 'job-1', status: jobStatus.running } as unknown as JobItem;
    const jobAttempt = {
      jobId: 'job-1',
      attempt: 1,
      status: jobStatus.running,
      startedAt: new Date(Date.now() - 5000).toISOString(),
    } as unknown as JobAttemptItem;
    return { job, jobAttempt };
  }

  it('completes the attempt and schedules the continuation', async () => {
    const context = createContext();
    mockJobAttemptService.continueJobAttempt.mockResolvedValue({ jobId: 'job-1', attempt: 2 });

    await applyContinuation(context, continueJob({ cursor: 'next' }));

    expect(mockJobAttemptService.continueJobAttempt).toHaveBeenCalledWith(
      'job-1',
      1,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        duration: expect.any(Number),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        completedAt: expect.any(String),
        response: undefined,
      }),
      { state: { cursor: 'next' }, scheduledAt: undefined },
    );
    expect(context.job.status).toBe(jobStatus.pending);
    expect(context.jobAttempt.status).toBe(jobStatus.completed);
  });

  it('passes response and scheduledAt through', async () => {
    const context = createContext();
    mockJobAttemptService.continueJobAttempt.mockResolvedValue({ jobId: 'job-1', attempt: 2 });

    await applyContinuation(
      context,
      continueJob(
        { cursor: 'next' },
        { scheduledAt: '2025-06-01T00:00:00Z', response: { processed: 10 } },
      ),
    );

    expect(mockJobAttemptService.continueJobAttempt).toHaveBeenCalledWith(
      'job-1',
      1,
      expect.objectContaining({ response: { processed: 10 } }),
      { state: { cursor: 'next' }, scheduledAt: '2025-06-01T00:00:00Z' },
    );
  });

  it('persists captured output on the completed slice', async () => {
    const context = createContext();
    const outputBuffer = new OutputBuffer();
    outputBuffer.append('info', 'synced page 7');
    mockJobAttemptService.continueJobAttempt.mockResolvedValue({ jobId: 'job-1', attempt: 2 });

    await applyContinuation({ ...context, outputBuffer }, continueJob({ cursor: 'next' }));

    expect(mockJobAttemptService.continueJobAttempt).toHaveBeenCalledWith(
      'job-1',
      1,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        output: expect.stringContaining('synced page 7'),
        outputTruncated: undefined,
      }),
      { state: { cursor: 'next' }, scheduledAt: undefined },
    );
  });

  it('throws when the attempt has no startedAt', async () => {
    const context = createContext();
    Object.assign(context.jobAttempt, { startedAt: undefined });

    await expect(applyContinuation(context, continueJob({}))).rejects.toThrow(
      'Job attempt has no startedAt',
    );
    expect(mockJobAttemptService.continueJobAttempt).not.toHaveBeenCalled();
  });
});
