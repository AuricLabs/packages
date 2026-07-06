vi.mock('@auriclabs/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const mockJobService = {
  getJob: vi.fn(),
};

const mockJobAttemptService = {
  getJobAttempt: vi.fn(),
  markJobAttemptAsRunning: vi.fn(),
};

const mockJobQueueService = {
  addToQueue: vi.fn(),
};

vi.mock('../init', () => ({
  getJobService: () => mockJobService,
  getJobAttemptService: () => mockJobAttemptService,
  getJobQueueService: () => mockJobQueueService,
}));

import { jobStatus } from '../types';

import { startJob } from './start-job';

describe('startJob', () => {
  const baseMessage = { jobId: 'job-1', attempt: 1, queue: 'lambda' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success when job starts', async () => {
    const mockJob = { id: 'job-1', status: jobStatus.pending, queue: 'lambda' };
    const mockAttempt = { jobId: 'job-1', attempt: 1 };
    const startedAt = '2025-01-01T00:00:00Z';

    mockJobAttemptService.getJobAttempt.mockResolvedValue(mockAttempt);
    mockJobService.getJob.mockResolvedValue(mockJob);
    mockJobAttemptService.markJobAttemptAsRunning.mockResolvedValue(startedAt);

    const result = await startJob(baseMessage);

    expect(result.success).toBe(true);
    expect(result.job.status).toBe(jobStatus.running);
    expect(result.jobAttempt.startedAt).toBe(startedAt);
    expect(result.jobAttempt.status).toBe(jobStatus.running);
  });

  it('re-queues when scheduledAt is in the future', async () => {
    const futureDate = new Date(Date.now() + 60000).toISOString();
    const mockJob = { id: 'job-1', status: jobStatus.pending, queue: 'lambda' };
    const mockAttempt = { jobId: 'job-1', attempt: 1, scheduledAt: futureDate };

    mockJobAttemptService.getJobAttempt.mockResolvedValue(mockAttempt);
    mockJobService.getJob.mockResolvedValue(mockJob);

    const result = await startJob(baseMessage);

    expect(result.success).toBe(false);
    expect(mockJobQueueService.addToQueue).toHaveBeenCalledWith('lambda', 'job-1', 1, futureDate);
    expect(mockJobAttemptService.markJobAttemptAsRunning).not.toHaveBeenCalled();
  });

  it('returns false when job is not pending (markJobAttemptAsRunning returns false)', async () => {
    const mockJob = { id: 'job-1', status: jobStatus.running, queue: 'lambda' };
    const mockAttempt = { jobId: 'job-1', attempt: 1 };

    mockJobAttemptService.getJobAttempt.mockResolvedValue(mockAttempt);
    mockJobService.getJob.mockResolvedValue(mockJob);
    mockJobAttemptService.markJobAttemptAsRunning.mockResolvedValue(false);

    const result = await startJob(baseMessage);

    expect(result.success).toBe(false);
  });

  it('exposes a capturing log context', async () => {
    const mockJob = { id: 'job-1', status: jobStatus.pending, queue: 'lambda' };
    const mockAttempt = { jobId: 'job-1', attempt: 1 };

    mockJobAttemptService.getJobAttempt.mockResolvedValue(mockAttempt);
    mockJobService.getJob.mockResolvedValue(mockJob);
    mockJobAttemptService.markJobAttemptAsRunning.mockResolvedValue('2025-01-01T00:00:00Z');

    const result = await startJob(baseMessage);

    result.log('hello from the job');
    result.logger.warn('watch out');

    const output = result.outputBuffer.serialize();
    expect(output).toContain('[info] hello from the job');
    expect(output).toContain('[warn] watch out');
  });

  it('does not re-queue when scheduledAt is in the past', async () => {
    const pastDate = new Date(Date.now() - 60000).toISOString();
    const mockJob = { id: 'job-1', status: jobStatus.pending, queue: 'lambda' };
    const mockAttempt = { jobId: 'job-1', attempt: 1, scheduledAt: pastDate };
    const startedAt = '2025-01-01T00:00:00Z';

    mockJobAttemptService.getJobAttempt.mockResolvedValue(mockAttempt);
    mockJobService.getJob.mockResolvedValue(mockJob);
    mockJobAttemptService.markJobAttemptAsRunning.mockResolvedValue(startedAt);

    const result = await startJob(baseMessage);

    expect(result.success).toBe(true);
    expect(mockJobQueueService.addToQueue).not.toHaveBeenCalled();
  });
});
