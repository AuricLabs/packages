const mockJobService = {
  getJob: vi.fn(),
};

const mockJobAttemptService = {
  getJobAttempt: vi.fn(),
};

vi.mock('../init', () => ({
  getJobService: () => mockJobService,
  getJobAttemptService: () => mockJobAttemptService,
}));

import { getJobContext } from './get-start-context';

describe('getJobContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches job and attempt', async () => {
    const mockJob = { id: 'job-1', status: 'pending' };
    const mockAttempt = { jobId: 'job-1', attempt: 1 };

    mockJobService.getJob.mockResolvedValue(mockJob);
    mockJobAttemptService.getJobAttempt.mockResolvedValue(mockAttempt);

    const result = await getJobContext('job-1', 1);

    expect(mockJobService.getJob).toHaveBeenCalledWith('job-1');
    expect(mockJobAttemptService.getJobAttempt).toHaveBeenCalledWith('job-1', 1);
    expect(result).toEqual({ job: mockJob, jobAttempt: mockAttempt });
  });

  it('propagates errors from getJob', async () => {
    mockJobService.getJob.mockRejectedValue(new Error('not found'));

    await expect(getJobContext('job-1', 1)).rejects.toThrow('not found');
  });

  it('propagates errors from getJobAttempt', async () => {
    mockJobService.getJob.mockResolvedValue({ id: 'job-1' });
    mockJobAttemptService.getJobAttempt.mockRejectedValue(new Error('attempt not found'));

    await expect(getJobContext('job-1', 1)).rejects.toThrow('attempt not found');
  });
});
