vi.mock('@auriclabs/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const mockJobService = vi.hoisted(() => ({
  getJob: vi.fn(),
  listJobs: vi.fn(),
  listJobsByStatus: vi.fn(),
  getJobSummary: vi.fn(),
  updateJobStatus: vi.fn(),
}));

const mockJobAttemptService = vi.hoisted(() => ({
  getJobAttempt: vi.fn(),
  getAllJobAttempts: vi.fn(),
  scheduleJobAttempt: vi.fn(),
}));

vi.mock('../init', () => ({
  getJobService: () => mockJobService,
  getJobAttemptService: () => mockJobAttemptService,
}));

import { NotFoundError } from 'http-errors-enhanced';

import { routeRequest } from './router';

describe('routeRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/jobs', () => {
    it('lists all jobs when no status filter is given', async () => {
      const jobs = [{ id: 'job-1' }];
      mockJobService.listJobs.mockResolvedValue(jobs);

      const result = await routeRequest('GET', '/api/jobs', undefined);

      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual({ jobs, cursor: null });
      expect(mockJobService.listJobs).toHaveBeenCalledWith({ limit: undefined });
    });

    it('lists by status with a limit', async () => {
      mockJobService.listJobsByStatus.mockResolvedValue({
        data: [{ id: 'job-1' }],
        cursor: null,
      });

      const result = await routeRequest('GET', '/api/jobs', undefined, {
        status: 'failed',
        limit: '25',
      });

      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual({ jobs: [{ id: 'job-1' }], cursor: null });
      expect(mockJobService.listJobsByStatus).toHaveBeenCalledWith('failed', { limit: 25 });
    });

    it('rejects an unknown status', async () => {
      const result = await routeRequest('GET', '/api/jobs', undefined, { status: 'bogus' });

      expect(result.statusCode).toBe(400);
    });

    it('rejects an out-of-range limit', async () => {
      const result = await routeRequest('GET', '/api/jobs', undefined, { limit: '9999' });

      expect(result.statusCode).toBe(400);
    });
  });

  describe('GET /api/jobs/summary', () => {
    it('returns the per-status counts', async () => {
      const summary = { pending: 1, running: 0, completed: 5, failed: 2, cancelled: 0 };
      mockJobService.getJobSummary.mockResolvedValue(summary);

      const result = await routeRequest('GET', '/api/jobs/summary', undefined);

      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual(summary);
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('returns the job with its attempts newest-first', async () => {
      const job = { id: 'job-1', status: 'failed' };
      const attempts = [{ jobId: 'job-1', attempt: 2 }];
      mockJobService.getJob.mockResolvedValue(job);
      mockJobAttemptService.getAllJobAttempts.mockResolvedValue({ data: attempts });

      const result = await routeRequest('GET', '/api/jobs/job-1', undefined);

      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual({ job, attempts });
      expect(mockJobAttemptService.getAllJobAttempts).toHaveBeenCalledWith('job-1', {
        pages: 'all',
        order: 'desc',
      });
    });

    it('maps NotFoundError to 404', async () => {
      mockJobService.getJob.mockRejectedValue(new NotFoundError('JOB_NOT_FOUND'));

      const result = await routeRequest('GET', '/api/jobs/missing', undefined);

      expect(result.statusCode).toBe(404);
    });
  });

  describe('POST /api/jobs/:id/retry', () => {
    it('schedules a retry', async () => {
      mockJobService.getJob.mockResolvedValue({ id: 'job-1', totalAttempts: 1 });
      mockJobAttemptService.getJobAttempt.mockResolvedValue({ jobId: 'job-1', attempt: 1 });
      mockJobAttemptService.scheduleJobAttempt.mockResolvedValue({ jobId: 'job-1', attempt: 2 });

      const result = await routeRequest('POST', '/api/jobs/job-1/retry', undefined);

      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual({
        retried: true,
        jobAttempt: { jobId: 'job-1', attempt: 2 },
      });
    });

    it('passes scheduledAt from the body', async () => {
      mockJobService.getJob.mockResolvedValue({ id: 'job-1', totalAttempts: 0 });
      mockJobAttemptService.scheduleJobAttempt.mockResolvedValue({ jobId: 'job-1', attempt: 1 });

      await routeRequest(
        'POST',
        '/api/jobs/job-1/retry',
        JSON.stringify({ scheduledAt: '2025-06-01T00:00:00Z' }),
      );

      expect(mockJobAttemptService.scheduleJobAttempt).toHaveBeenCalledWith(
        'job-1',
        '2025-06-01T00:00:00Z',
        undefined,
      );
    });

    it('rejects invalid JSON bodies', async () => {
      const result = await routeRequest('POST', '/api/jobs/job-1/retry', '{nope');

      expect(result.statusCode).toBe(400);
    });

    it('maps a retry on a running job to 409', async () => {
      mockJobService.getJob.mockResolvedValue({
        id: 'job-1',
        status: 'running',
        totalAttempts: 1,
      });
      mockJobAttemptService.getJobAttempt.mockResolvedValue({ jobId: 'job-1', attempt: 1 });
      mockJobAttemptService.scheduleJobAttempt.mockRejectedValue(
        new NotFoundError('JOB_NOT_FOUND'),
      );

      const result = await routeRequest('POST', '/api/jobs/job-1/retry', undefined);

      expect(result.statusCode).toBe(409);
      expect(result.body).toEqual({ retried: false, error: 'Job is running' });
    });

    it('maps a retry on a missing job to 404', async () => {
      mockJobService.getJob.mockRejectedValue(new NotFoundError('JOB_NOT_FOUND'));

      const result = await routeRequest('POST', '/api/jobs/missing/retry', undefined);

      expect(result.statusCode).toBe(404);
    });

    it('rejects malformed percent-encoding with 400', async () => {
      const result = await routeRequest('POST', '/api/jobs/%zz/retry', undefined);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('POST /api/jobs/:id/cancel', () => {
    it('cancels a pending job', async () => {
      mockJobService.updateJobStatus.mockResolvedValue(true);

      const result = await routeRequest('POST', '/api/jobs/job-1/cancel', undefined);

      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual({ cancelled: true });
      expect(mockJobService.updateJobStatus).toHaveBeenCalledWith('job-1', 'cancelled', 'pending');
    });

    it('returns 409 when the job is not pending', async () => {
      mockJobService.updateJobStatus.mockResolvedValue(false);

      const result = await routeRequest('POST', '/api/jobs/job-1/cancel', undefined);

      expect(result.statusCode).toBe(409);
      expect(result.body).toEqual({ cancelled: false, error: 'Job is not pending' });
    });
  });

  it('returns 404 for unknown routes', async () => {
    const result = await routeRequest('GET', '/api/nope', undefined);

    expect(result.statusCode).toBe(404);
  });

  it('normalizes trailing slashes', async () => {
    mockJobService.listJobs.mockResolvedValue([]);

    const result = await routeRequest('GET', '/api/jobs/', undefined);

    expect(result.statusCode).toBe(200);
  });
});
