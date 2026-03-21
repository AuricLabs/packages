vi.mock('@auriclabs/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const mockJobService = {
  createJob: vi.fn(),
};

const mockJobAttemptService = {
  scheduleJobAttempt: vi.fn(),
};

vi.mock('../init', () => ({
  getJobService: () => mockJobService,
  getJobAttemptService: () => mockJobAttemptService,
}));

import { scheduleJob } from './schedule-job';

describe('scheduleJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a job and schedules an attempt', async () => {
    const mockJob = { id: 'job-1', fn: 'handler', queue: 'lambda', payload: { data: 1 } };
    const mockAttempt = { jobId: 'job-1', attempt: 1 };

    mockJobService.createJob.mockResolvedValue(mockJob);
    mockJobAttemptService.scheduleJobAttempt.mockResolvedValue(mockAttempt);

    const result = await scheduleJob('lambda', 'handler', { data: 1 });

    expect(mockJobService.createJob).toHaveBeenCalledWith({
      fn: 'handler',
      queue: 'lambda',
      payload: { data: 1 },
    });
    expect(mockJobAttemptService.scheduleJobAttempt).toHaveBeenCalledWith('job-1', undefined);
    expect(result).toEqual({ job: mockJob, jobAttempt: mockAttempt });
  });

  it('passes scheduledAt to scheduleJobAttempt', async () => {
    const mockJob = { id: 'job-2' };
    mockJobService.createJob.mockResolvedValue(mockJob);
    mockJobAttemptService.scheduleJobAttempt.mockResolvedValue({ jobId: 'job-2', attempt: 1 });

    await scheduleJob('lambda', 'handler', {}, '2025-06-01T00:00:00Z');

    expect(mockJobAttemptService.scheduleJobAttempt).toHaveBeenCalledWith(
      'job-2',
      '2025-06-01T00:00:00Z',
    );
  });
});
