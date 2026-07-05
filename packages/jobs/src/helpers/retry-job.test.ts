vi.mock('@auriclabs/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const mockJobService = {
  getJob: vi.fn(),
};

const mockJobAttemptService = {
  getJobAttempt: vi.fn(),
  scheduleJobAttempt: vi.fn(),
};

vi.mock('../init', () => ({
  getJobService: () => mockJobService,
  getJobAttemptService: () => mockJobAttemptService,
}));

import { retryJob } from './retry-job';

describe('retryJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('schedules a new attempt for the job', async () => {
    mockJobService.getJob.mockResolvedValue({ id: 'job-1', totalAttempts: 1 });
    mockJobAttemptService.getJobAttempt.mockResolvedValue({ jobId: 'job-1', attempt: 1 });
    const mockAttempt = { jobId: 'job-1', attempt: 2 };
    mockJobAttemptService.scheduleJobAttempt.mockResolvedValue(mockAttempt);

    const result = await retryJob('job-1');

    expect(mockJobAttemptService.scheduleJobAttempt).toHaveBeenCalledWith(
      'job-1',
      undefined,
      undefined,
    );
    expect(result).toEqual({ jobAttempt: mockAttempt });
  });

  it('passes scheduledAt through', async () => {
    mockJobService.getJob.mockResolvedValue({ id: 'job-1', totalAttempts: 1 });
    mockJobAttemptService.getJobAttempt.mockResolvedValue({ jobId: 'job-1', attempt: 1 });
    mockJobAttemptService.scheduleJobAttempt.mockResolvedValue({ jobId: 'job-1', attempt: 3 });

    await retryJob('job-1', '2025-06-01T00:00:00Z');

    expect(mockJobAttemptService.scheduleJobAttempt).toHaveBeenCalledWith(
      'job-1',
      '2025-06-01T00:00:00Z',
      undefined,
    );
  });

  it('carries the last attempt continuation state into the retry', async () => {
    mockJobService.getJob.mockResolvedValue({ id: 'job-1', totalAttempts: 3 });
    mockJobAttemptService.getJobAttempt.mockResolvedValue({
      jobId: 'job-1',
      attempt: 3,
      state: { cursor: 'page-7' },
    });
    mockJobAttemptService.scheduleJobAttempt.mockResolvedValue({ jobId: 'job-1', attempt: 4 });

    await retryJob('job-1');

    expect(mockJobAttemptService.getJobAttempt).toHaveBeenCalledWith('job-1', 3);
    expect(mockJobAttemptService.scheduleJobAttempt).toHaveBeenCalledWith('job-1', undefined, {
      cursor: 'page-7',
    });
  });

  it('still retries when the last attempt cannot be loaded', async () => {
    mockJobService.getJob.mockResolvedValue({ id: 'job-1', totalAttempts: 2 });
    mockJobAttemptService.getJobAttempt.mockRejectedValue(new Error('not found'));
    mockJobAttemptService.scheduleJobAttempt.mockResolvedValue({ jobId: 'job-1', attempt: 3 });

    const result = await retryJob('job-1');

    expect(result.jobAttempt).toEqual({ jobId: 'job-1', attempt: 3 });
    expect(mockJobAttemptService.scheduleJobAttempt).toHaveBeenCalledWith(
      'job-1',
      undefined,
      undefined,
    );
  });
});
