/* eslint-disable @typescript-eslint/unbound-method */
import { ElectroError } from 'electrodb';
import { NotFoundError } from 'http-errors-enhanced';

import { JobAttemptEntity } from '../models';
import { jobStatus } from '../types';

import { createJobAttemptService, JobAttemptServiceInstance } from './job-attempt.service';
import { JobServiceInstance } from './job.service';

vi.mock('@auriclabs/pagination', () => ({
  normalizePaginationResponse: vi.fn((promise: Promise<unknown>) => promise),
}));

function createMockJobAttemptEntity() {
  const mockGo = vi.fn();
  const mockSet = vi.fn();
  const mockWhere = vi.fn();
  const mockRemove = vi.fn();

  const chainable = { set: mockSet, where: mockWhere, remove: mockRemove, go: mockGo };
  mockSet.mockReturnValue(chainable);
  mockWhere.mockReturnValue(chainable);
  mockRemove.mockReturnValue(chainable);

  const entity = {
    get: vi.fn(() => ({ go: mockGo })),
    create: vi.fn(() => ({ go: mockGo })),
    patch: vi.fn(() => chainable),
    query: {
      jobAttempts: vi.fn(() => ({ go: vi.fn().mockResolvedValue({ data: [], cursor: null }) })),
    },
  };

  return { entity, mockGo, mockSet, mockWhere, mockRemove };
}

function createMockJobService(): JobServiceInstance {
  return {
    getJob: vi.fn(),
    updateJobStatus: vi.fn(),
    updateJob: vi.fn(),
    createJob: vi.fn(),
    prepareNextJobAttempt: vi.fn(),
    prepareContinuationAttempt: vi.fn(),
  };
}

describe('jobAttemptService', () => {
  let service: JobAttemptServiceInstance;
  let mocks: ReturnType<typeof createMockJobAttemptEntity>;
  let mockJobService: ReturnType<typeof createMockJobService>;

  beforeEach(() => {
    mocks = createMockJobAttemptEntity();
    mockJobService = createMockJobService();
    service = createJobAttemptService(mocks.entity as unknown as JobAttemptEntity, mockJobService);
  });

  describe('scheduleJobAttempt', () => {
    it('calls prepareNextJobAttempt then creates the attempt', async () => {
      vi.mocked(mockJobService.prepareNextJobAttempt).mockResolvedValue(2);
      const mockAttempt = { jobId: 'job-1', attempt: 2, scheduledAt: undefined };
      mocks.mockGo.mockResolvedValue({ data: mockAttempt });

      const result = await service.scheduleJobAttempt('job-1');

      expect(mockJobService.prepareNextJobAttempt).toHaveBeenCalledWith('job-1');
      expect(mocks.entity.create).toHaveBeenCalledWith({
        jobId: 'job-1',
        attempt: 2,
        scheduledAt: undefined,
      });
      expect(result).toBe(mockAttempt);
    });

    it('passes scheduledAt to the create call', async () => {
      vi.mocked(mockJobService.prepareNextJobAttempt).mockResolvedValue(1);
      mocks.mockGo.mockResolvedValue({ data: { jobId: 'job-1', attempt: 1 } });

      await service.scheduleJobAttempt('job-1', '2025-01-01T00:00:00Z');

      expect(mocks.entity.create).toHaveBeenCalledWith({
        jobId: 'job-1',
        attempt: 1,
        scheduledAt: '2025-01-01T00:00:00Z',
      });
    });
  });

  describe('continueJobAttempt', () => {
    it('completes the current attempt, transitions the job, and creates the next attempt', async () => {
      vi.mocked(mockJobService.prepareContinuationAttempt).mockResolvedValue(2);
      const nextAttempt = { jobId: 'job-1', attempt: 2, state: { cursor: 'abc' } };
      mocks.mockGo.mockResolvedValue({ data: nextAttempt });

      const result = await service.continueJobAttempt(
        'job-1',
        1,
        { duration: 5000, completedAt: '2025-01-01T00:00:05Z', response: { processed: 10 } },
        { state: { cursor: 'abc' }, scheduledAt: '2025-01-01T00:01:00Z' },
      );

      expect(mocks.entity.patch).toHaveBeenCalledWith({ jobId: 'job-1', attempt: 1 });
      expect(mocks.mockSet).toHaveBeenCalledWith({
        status: jobStatus.completed,
        duration: 5000,
        completedAt: '2025-01-01T00:00:05Z',
        response: { processed: 10 },
      });
      expect(mocks.mockRemove).toHaveBeenCalledWith(['error']);
      // job status is never written from here — prepareContinuationAttempt owns it
      expect(mockJobService.updateJobStatus).not.toHaveBeenCalled();
      expect(mockJobService.prepareContinuationAttempt).toHaveBeenCalledWith('job-1');
      expect(mocks.entity.create).toHaveBeenCalledWith({
        jobId: 'job-1',
        attempt: 2,
        scheduledAt: '2025-01-01T00:01:00Z',
        state: { cursor: 'abc' },
      });
      expect(result).toBe(nextAttempt);
    });

    it('reverts the attempt to running when the continuation fails after completion', async () => {
      // attempt patch succeeds, then the job transition fails
      mocks.mockGo.mockResolvedValue({});
      vi.mocked(mockJobService.prepareContinuationAttempt).mockRejectedValue(
        new Error('transition failed'),
      );

      await expect(
        service.continueJobAttempt(
          'job-1',
          1,
          { duration: 100, completedAt: '2025-01-01T00:00:00Z' },
          { state: { cursor: 'abc' } },
        ),
      ).rejects.toThrow('transition failed');

      // compensating patch: status back to running so stopJob can mark it failed
      expect(mocks.mockSet).toHaveBeenLastCalledWith({ status: jobStatus.running });
      expect(mocks.entity.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the attempt is not running', async () => {
      mocks.mockGo.mockRejectedValue(
        new ElectroError(1000, {
          message: 'condition failed',
          sections: {},
        } as unknown as ErrorConstructor),
      );

      await expect(
        service.continueJobAttempt(
          'job-1',
          1,
          { duration: 100, completedAt: '2025-01-01T00:00:00Z' },
          { state: null },
        ),
      ).rejects.toThrow(NotFoundError);
      expect(mockJobService.prepareContinuationAttempt).not.toHaveBeenCalled();
    });

    it('throws non-ElectroError errors', async () => {
      mocks.mockGo.mockRejectedValue(new Error('network error'));

      await expect(
        service.continueJobAttempt(
          'job-1',
          1,
          { duration: 100, completedAt: '2025-01-01T00:00:00Z' },
          { state: null },
        ),
      ).rejects.toThrow('network error');
    });
  });

  describe('rescheduleJobAttempt', () => {
    it('patches scheduledAt', async () => {
      mocks.mockGo.mockResolvedValue({});

      await service.rescheduleJobAttempt('job-1', 1, '2025-06-01T00:00:00Z');

      expect(mocks.entity.patch).toHaveBeenCalledWith({ jobId: 'job-1', attempt: 1 });
      expect(mocks.mockSet).toHaveBeenCalledWith({ scheduledAt: '2025-06-01T00:00:00Z' });
    });
  });

  describe('getJobAttempt', () => {
    it('returns the attempt when found', async () => {
      const mockAttempt = { jobId: 'job-1', attempt: 1 };
      mocks.mockGo.mockResolvedValue({ data: mockAttempt });

      const result = await service.getJobAttempt('job-1', 1);

      expect(result).toBe(mockAttempt);
      expect(mocks.entity.get).toHaveBeenCalledWith({ jobId: 'job-1', attempt: 1 });
      expect(mocks.mockGo).toHaveBeenCalledWith({ consistent: true });
    });

    it('throws NotFoundError when attempt is null', async () => {
      mocks.mockGo.mockResolvedValue({ data: null });

      await expect(service.getJobAttempt('job-1', 1)).rejects.toThrow(NotFoundError);
    });
  });

  describe('markJobAttemptAsRunning', () => {
    it('updates job status then attempt, returns startedAt', async () => {
      vi.mocked(mockJobService.updateJobStatus).mockResolvedValue(true);
      mocks.mockGo.mockResolvedValue({});

      const result = await service.markJobAttemptAsRunning('job-1', 1);

      expect(result).toEqual(expect.any(String));
      expect(mockJobService.updateJobStatus).toHaveBeenCalledWith(
        'job-1',
        jobStatus.running,
        jobStatus.pending,
      );
      expect(mocks.entity.patch).toHaveBeenCalledWith({ jobId: 'job-1', attempt: 1 });
      expect(mocks.mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: jobStatus.running,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          startedAt: expect.any(String),
        }),
      );
    });

    it('returns false when job status update fails', async () => {
      vi.mocked(mockJobService.updateJobStatus).mockResolvedValue(false);

      const result = await service.markJobAttemptAsRunning('job-1', 1);

      expect(result).toBe(false);
    });

    it('rolls back job status on ElectroError and returns false', async () => {
      vi.mocked(mockJobService.updateJobStatus).mockResolvedValue(true);
      mocks.mockGo.mockRejectedValue(
        new ElectroError(1000, {
          message: 'condition failed',
          sections: {},
        } as unknown as ErrorConstructor),
      );

      const result = await service.markJobAttemptAsRunning('job-1', 1);

      expect(result).toBe(false);
      expect(mockJobService.updateJobStatus).toHaveBeenCalledTimes(2);
      expect(mockJobService.updateJobStatus).toHaveBeenLastCalledWith(
        'job-1',
        jobStatus.pending,
        jobStatus.running,
      );
    });

    it('throws non-ElectroError errors', async () => {
      vi.mocked(mockJobService.updateJobStatus).mockResolvedValue(true);
      mocks.mockGo.mockRejectedValue(new Error('network error'));

      await expect(service.markJobAttemptAsRunning('job-1', 1)).rejects.toThrow('network error');
    });
  });

  describe('updateJobAttempt', () => {
    it('patches attempt and syncs job status', async () => {
      mocks.mockGo.mockResolvedValue({});
      vi.mocked(mockJobService.updateJobStatus).mockResolvedValue(true);

      await service.updateJobAttempt('job-1', 1, {
        status: jobStatus.completed,
        completedAt: '2025-01-01T00:00:00Z',
      });

      expect(mocks.entity.patch).toHaveBeenCalledWith({ jobId: 'job-1', attempt: 1 });
      expect(mocks.mockSet).toHaveBeenCalledWith({
        status: jobStatus.completed,
        completedAt: '2025-01-01T00:00:00Z',
      });
      expect(mockJobService.updateJobStatus).toHaveBeenCalledWith(
        'job-1',
        jobStatus.completed,
        jobStatus.running,
      );
    });

    it('removes error when completing an attempt', async () => {
      mocks.mockGo.mockResolvedValue({});
      vi.mocked(mockJobService.updateJobStatus).mockResolvedValue(true);

      await service.updateJobAttempt('job-1', 1, { status: jobStatus.completed });

      expect(mocks.mockRemove).toHaveBeenCalledWith(['error']);
    });

    it('does not remove error when failing an attempt', async () => {
      mocks.mockGo.mockResolvedValue({});
      vi.mocked(mockJobService.updateJobStatus).mockResolvedValue(true);

      await service.updateJobAttempt('job-1', 1, { status: jobStatus.failed, error: 'boom' });

      expect(mocks.mockRemove).not.toHaveBeenCalled();
    });

    it('does not sync job status when no status in update fields', async () => {
      mocks.mockGo.mockResolvedValue({});

      await service.updateJobAttempt('job-1', 1, { duration: 5000 });

      expect(mockJobService.updateJobStatus).not.toHaveBeenCalled();
    });

    it('throws NotFoundError on ElectroError', async () => {
      mocks.mockGo.mockRejectedValue(
        new ElectroError(1000, {
          message: 'condition failed',
          sections: {},
        } as unknown as ErrorConstructor),
      );

      await expect(
        service.updateJobAttempt('job-1', 1, { status: jobStatus.completed }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws non-ElectroError errors', async () => {
      mocks.mockGo.mockRejectedValue(new Error('network error'));

      await expect(
        service.updateJobAttempt('job-1', 1, { status: jobStatus.completed }),
      ).rejects.toThrow('network error');
    });
  });

  describe('getAllJobAttempts', () => {
    it('queries with options and returns normalized response', async () => {
      const mockData = { data: [{ jobId: 'job-1', attempt: 1 }], cursor: null };
      const mockQueryGo = vi.fn().mockResolvedValue(mockData);
      mocks.entity.query.jobAttempts = vi.fn(() => ({ go: mockQueryGo }));

      await service.getAllJobAttempts('job-1', { limit: 10, order: 'asc' });

      expect(mocks.entity.query.jobAttempts).toHaveBeenCalledWith({ jobId: 'job-1' });
      expect(mockQueryGo).toHaveBeenCalledWith({ limit: 10, order: 'asc' });
    });
  });
});
