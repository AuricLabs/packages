vi.mock('@auriclabs/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const mockJobAttemptService = {
  updateJobAttempt: vi.fn(),
};

vi.mock('../init', () => ({
  getJobAttemptService: () => mockJobAttemptService,
}));

import { JobAttemptItem, JobItem } from '../models';
import { jobStatus } from '../types';

import { OutputBuffer } from './output-buffer';
import { stopJob } from './stop-job';

function makeJob(overrides: Partial<JobItem> = {}): JobItem {
  return { id: 'job-1', status: jobStatus.running, ...overrides } as unknown as JobItem;
}

function makeAttempt(overrides: Partial<JobAttemptItem> = {}): JobAttemptItem {
  return {
    jobId: 'job-1',
    attempt: 1,
    startedAt: '2025-01-01T00:00:00.000Z',
    status: jobStatus.running,
    ...overrides,
  } as unknown as JobAttemptItem;
}

describe('stopJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists captured output on completion', async () => {
    mockJobAttemptService.updateJobAttempt.mockResolvedValue(undefined);
    const outputBuffer = new OutputBuffer();
    outputBuffer.append('info', 'processed 42 items');

    await stopJob({ job: makeJob(), jobAttempt: makeAttempt(), outputBuffer }, { success: true });

    expect(mockJobAttemptService.updateJobAttempt).toHaveBeenCalledWith(
      'job-1',
      1,
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        output: expect.stringContaining('processed 42 items'),
        outputTruncated: undefined,
      }),
    );
  });

  it('persists output and truncation flag on failure', async () => {
    mockJobAttemptService.updateJobAttempt.mockResolvedValue(undefined);
    const outputBuffer = new OutputBuffer(64);
    outputBuffer.append('info', 'a line that is definitely longer than the tiny cap in this test');
    outputBuffer.append('error', 'about to fail');

    await stopJob(
      { job: makeJob(), jobAttempt: makeAttempt(), outputBuffer },
      { success: false, error: new Error('boom') },
    );

    expect(mockJobAttemptService.updateJobAttempt).toHaveBeenCalledWith(
      'job-1',
      1,
      expect.objectContaining({
        status: jobStatus.failed,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        output: expect.stringContaining('about to fail'),
        outputTruncated: true,
      }),
    );
  });

  it('retries without output when persisting with output fails', async () => {
    // e.g. output + response together blow DynamoDB's 400KB item limit
    mockJobAttemptService.updateJobAttempt
      .mockRejectedValueOnce(new Error('Item size has exceeded the maximum allowed size'))
      .mockResolvedValueOnce(undefined);
    const outputBuffer = new OutputBuffer();
    outputBuffer.append('info', 'lots of output');

    const result = await stopJob(
      { job: makeJob(), jobAttempt: makeAttempt(), outputBuffer },
      { success: true },
    );

    expect(result.success).toBe(true);
    expect(mockJobAttemptService.updateJobAttempt).toHaveBeenCalledTimes(2);
    expect(mockJobAttemptService.updateJobAttempt).toHaveBeenLastCalledWith(
      'job-1',
      1,
      expect.objectContaining({ output: undefined, outputTruncated: true }),
    );
  });

  it('does not retry when there was no output to shed', async () => {
    mockJobAttemptService.updateJobAttempt.mockRejectedValue(new Error('update failed'));

    const result = await stopJob({ job: makeJob(), jobAttempt: makeAttempt() }, { success: true });

    expect(result.success).toBe(false);
    expect(mockJobAttemptService.updateJobAttempt).toHaveBeenCalledTimes(1);
  });

  it('omits output when the buffer is empty', async () => {
    mockJobAttemptService.updateJobAttempt.mockResolvedValue(undefined);

    await stopJob(
      { job: makeJob(), jobAttempt: makeAttempt(), outputBuffer: new OutputBuffer() },
      { success: true },
    );

    expect(mockJobAttemptService.updateJobAttempt).toHaveBeenCalledWith(
      'job-1',
      1,
      expect.objectContaining({ output: undefined }),
    );
  });

  it('records success completion', async () => {
    mockJobAttemptService.updateJobAttempt.mockResolvedValue(undefined);

    const result = await stopJob(
      { job: makeJob(), jobAttempt: makeAttempt() },
      { success: true, data: { result: 'ok' } },
    );

    expect(result.success).toBe(true);
    expect(result.job.status).toBe(jobStatus.completed);
    expect(mockJobAttemptService.updateJobAttempt).toHaveBeenCalledWith(
      'job-1',
      1,

      expect.objectContaining({
        status: jobStatus.completed,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        duration: expect.any(Number),
        response: { result: 'ok' },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        completedAt: expect.any(String),
      }),
    );
  });

  it('records failure with error', async () => {
    mockJobAttemptService.updateJobAttempt.mockResolvedValue(undefined);

    const result = await stopJob(
      { job: makeJob(), jobAttempt: makeAttempt() },
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        failedAt: expect.any(String),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        duration: expect.any(Number),
      }),
    );
  });

  it('records failure with Error object', async () => {
    mockJobAttemptService.updateJobAttempt.mockResolvedValue(undefined);
    const err = new Error('test error');

    const result = await stopJob(
      { job: makeJob(), jobAttempt: makeAttempt() },
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
    const attemptNoStart = makeAttempt({ startedAt: undefined });

    await expect(
      stopJob({ job: makeJob(), jobAttempt: attemptNoStart }, { success: true }),
    ).rejects.toThrow('Job attempt has no startedAt');
  });

  it('returns success false when updateJobAttempt throws', async () => {
    mockJobAttemptService.updateJobAttempt.mockRejectedValue(new Error('update failed'));

    const result = await stopJob({ job: makeJob(), jobAttempt: makeAttempt() }, { success: true });

    expect(result.success).toBe(false);
  });

  it('infers success when response has no success or error field', async () => {
    mockJobAttemptService.updateJobAttempt.mockResolvedValue(undefined);

    const result = await stopJob(
      { job: makeJob(), jobAttempt: makeAttempt() },
      { data: { info: 'some data' } },
    );

    expect(result.success).toBe(true);
    expect(result.job.status).toBe(jobStatus.completed);
  });

  it('infers failure when response has error but no success field', async () => {
    mockJobAttemptService.updateJobAttempt.mockResolvedValue(undefined);

    const result = await stopJob(
      { job: makeJob(), jobAttempt: makeAttempt() },
      { error: 'failed' },
    );

    expect(result.success).toBe(true);
    expect(result.job.status).toBe(jobStatus.failed);
  });
});
