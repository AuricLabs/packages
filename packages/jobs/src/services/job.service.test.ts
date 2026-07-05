import { ElectroError } from 'electrodb';
import { NotFoundError } from 'http-errors-enhanced';

import { JobErrorCodes } from '../errors';
import { JobCreateFields, JobEntity } from '../models';
import { jobStatus } from '../types';

import { createJobService, JobServiceInstance } from './job.service';

vi.mock('@auriclabs/pagination', () => ({
  normalizePaginationResponse: vi.fn((promise: Promise<unknown>) => promise),
}));

function createMockJobEntity() {
  const mockGo = vi.fn();
  const mockSet = vi.fn();
  const mockAdd = vi.fn();
  const mockWhere = vi.fn();
  const mockQueryGo = vi.fn();

  // Chain: patch() -> { set, add, where, go }
  // set() -> { where, go, add }
  // add() -> { where, go, set }
  // where() -> { go }
  const chainable = { set: mockSet, add: mockAdd, where: mockWhere, go: mockGo };
  mockSet.mockReturnValue(chainable);
  mockAdd.mockReturnValue(chainable);
  mockWhere.mockReturnValue(chainable);

  const entity = {
    get: vi.fn(() => ({ go: mockGo })),
    create: vi.fn(() => ({ go: mockGo })),
    patch: vi.fn(() => chainable),
    query: {
      jobStatuses: vi.fn(() => ({ go: mockQueryGo })),
    },
  };

  return { entity, mockGo, mockSet, mockAdd, mockWhere, mockQueryGo };
}

describe('jobService', () => {
  let service: JobServiceInstance;
  let mocks: ReturnType<typeof createMockJobEntity>;

  beforeEach(() => {
    mocks = createMockJobEntity();
    service = createJobService(mocks.entity as unknown as JobEntity);
  });

  describe('getJob', () => {
    it('returns the job when found', async () => {
      const mockJob = { id: 'job-1', status: 'pending' };
      mocks.mockGo.mockResolvedValue({ data: mockJob });

      const result = await service.getJob('job-1');

      expect(result).toBe(mockJob);
      expect(mocks.entity.get).toHaveBeenCalledWith({ id: 'job-1' });
      expect(mocks.mockGo).toHaveBeenCalledWith({ consistent: true });
    });

    it('throws NotFoundError when job is null', async () => {
      mocks.mockGo.mockResolvedValue({ data: null });

      await expect(service.getJob('job-1')).rejects.toThrow(NotFoundError);
      await expect(service.getJob('job-1')).rejects.toThrow(JobErrorCodes.JOB_NOT_FOUND);
    });
  });

  describe('listJobsByStatus', () => {
    it('reads the full status partition and sorts newest-first', async () => {
      mocks.mockQueryGo.mockResolvedValue({
        data: [
          { id: 'old', createdAt: '2025-01-01T00:00:00Z' },
          { id: 'new', createdAt: '2025-03-01T00:00:00Z' },
        ],
      });

      const result = await service.listJobsByStatus(jobStatus.failed, { limit: 25 });

      expect(mocks.entity.query.jobStatuses).toHaveBeenCalledWith({ status: jobStatus.failed });
      expect(mocks.mockQueryGo).toHaveBeenCalledWith({ pages: 'all' });
      expect(result.data.map((job) => job.id)).toEqual(['new', 'old']);
      expect(result.cursor).toBeNull();
    });

    it('caps the result at the limit', async () => {
      mocks.mockQueryGo.mockResolvedValue({
        data: [
          { id: 'a', createdAt: '2025-01-01T00:00:00Z' },
          { id: 'b', createdAt: '2025-01-02T00:00:00Z' },
          { id: 'c', createdAt: '2025-01-03T00:00:00Z' },
        ],
      });

      const result = await service.listJobsByStatus(jobStatus.completed, { limit: 2 });

      expect(result.data.map((job) => job.id)).toEqual(['c', 'b']);
    });
  });

  describe('listJobs', () => {
    it('fans out one query per status and merges newest-first', async () => {
      mocks.mockQueryGo
        .mockResolvedValueOnce({ data: [{ id: 'a', createdAt: '2025-01-01T00:00:00Z' }] })
        .mockResolvedValueOnce({ data: [{ id: 'b', createdAt: '2025-03-01T00:00:00Z' }] })
        .mockResolvedValueOnce({ data: [{ id: 'c', createdAt: '2025-02-01T00:00:00Z' }] })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] });

      const result = await service.listJobs();

      expect(mocks.entity.query.jobStatuses).toHaveBeenCalledTimes(5);
      expect(mocks.mockQueryGo).toHaveBeenCalledWith({ pages: 'all' });
      expect(result.map((job) => job.id)).toEqual(['b', 'c', 'a']);
    });

    it('caps the merged result at the limit', async () => {
      mocks.mockQueryGo.mockResolvedValue({
        data: [
          { id: 'x', createdAt: '2025-01-01T00:00:00Z' },
          { id: 'y', createdAt: '2025-01-02T00:00:00Z' },
        ],
      });

      const result = await service.listJobs({ limit: 3 });

      expect(result).toHaveLength(3);
    });
  });

  describe('getJobSummary', () => {
    it('returns a count per status', async () => {
      mocks.mockQueryGo
        .mockResolvedValueOnce({ data: [{ id: '1' }, { id: '2' }] })
        .mockResolvedValueOnce({ data: [{ id: '3' }] })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [{ id: '4' }] })
        .mockResolvedValueOnce({ data: [] });

      const summary = await service.getJobSummary();

      expect(summary).toEqual({
        pending: 2,
        running: 1,
        completed: 0,
        failed: 1,
        cancelled: 0,
      });
      expect(mocks.mockQueryGo).toHaveBeenCalledWith({ pages: 'all', attributes: ['id'] });
    });
  });

  describe('updateJobStatus', () => {
    it('returns true on success', async () => {
      mocks.mockGo.mockResolvedValue({});

      const result = await service.updateJobStatus('job-1', jobStatus.running, jobStatus.pending);

      expect(result).toBe(true);
      expect(mocks.entity.patch).toHaveBeenCalledWith({ id: 'job-1' });
      expect(mocks.mockSet).toHaveBeenCalledWith({ status: jobStatus.running });
      expect(mocks.mockWhere).toHaveBeenCalledWith(expect.any(Function));
    });

    it('returns false on ElectroError', async () => {
      mocks.mockGo.mockRejectedValue(
        new ElectroError(1000, {
          message: 'condition failed',
          sections: {},
        } as unknown as ErrorConstructor),
      );

      const result = await service.updateJobStatus('job-1', jobStatus.running, jobStatus.pending);
      expect(result).toBe(false);
    });

    it('throws non-ElectroError errors', async () => {
      mocks.mockGo.mockRejectedValue(new Error('network error'));

      await expect(
        service.updateJobStatus('job-1', jobStatus.running, jobStatus.pending),
      ).rejects.toThrow('network error');
    });
  });

  describe('updateJob', () => {
    it('patches with fields', async () => {
      mocks.mockGo.mockResolvedValue({});

      await service.updateJob('job-1', { status: jobStatus.completed });

      expect(mocks.entity.patch).toHaveBeenCalledWith({ id: 'job-1' });
      expect(mocks.mockSet).toHaveBeenCalledWith({ status: jobStatus.completed });
    });

    it('adds where clause when requiredStatus is provided', async () => {
      mocks.mockGo.mockResolvedValue({});

      await service.updateJob('job-1', { status: jobStatus.completed }, jobStatus.running);

      expect(mocks.mockWhere).toHaveBeenCalledWith(expect.any(Function));
    });

    it('throws NotFoundError on ElectroError', async () => {
      mocks.mockGo.mockRejectedValue(
        new ElectroError(1000, {
          message: 'condition failed',
          sections: {},
        } as unknown as ErrorConstructor),
      );

      await expect(service.updateJob('job-1', { status: jobStatus.completed })).rejects.toThrow(
        NotFoundError,
      );
    });

    it('throws non-ElectroError errors', async () => {
      mocks.mockGo.mockRejectedValue(new Error('network error'));

      await expect(service.updateJob('job-1', { status: jobStatus.completed })).rejects.toThrow(
        'network error',
      );
    });
  });

  describe('prepareContinuationAttempt', () => {
    it('moves the job from running back to pending and increments attempts', async () => {
      mocks.mockGo.mockResolvedValue({ data: { totalAttempts: 3 } });

      const result = await service.prepareContinuationAttempt('job-1');

      expect(result).toBe(3);
      expect(mocks.entity.patch).toHaveBeenCalledWith({ id: 'job-1' });
      expect(mocks.mockSet).toHaveBeenCalledWith({ status: jobStatus.pending });
      expect(mocks.mockAdd).toHaveBeenCalledWith({ totalAttempts: 1 });

      const whereFn = mocks.mockWhere.mock.calls[0][0] as (
        attr: { status: string },
        op: { eq: (attr: string, value: string) => string },
      ) => string;
      const eq = vi.fn((_attr: string, value: string) => `#status = ${value}`);
      whereFn({ status: 'status' }, { eq });
      expect(eq).toHaveBeenCalledWith('status', jobStatus.running);
    });

    it('throws NotFoundError on ElectroError', async () => {
      mocks.mockGo.mockRejectedValue(
        new ElectroError(1000, {
          message: 'condition failed',
          sections: {},
        } as unknown as ErrorConstructor),
      );

      await expect(service.prepareContinuationAttempt('job-1')).rejects.toThrow(NotFoundError);
    });

    it('throws non-ElectroError errors', async () => {
      mocks.mockGo.mockRejectedValue(new Error('network error'));

      await expect(service.prepareContinuationAttempt('job-1')).rejects.toThrow('network error');
    });
  });

  describe('createJob', () => {
    it('creates and returns a job', async () => {
      const mockJob = { id: 'job-1', queue: 'test', fn: 'handler', payload: {} };
      mocks.mockGo.mockResolvedValue({ data: mockJob });

      const result = await service.createJob({
        queue: 'test',
        fn: 'handler',
        payload: {},
      } as JobCreateFields);

      expect(result).toBe(mockJob);
      expect(mocks.entity.create).toHaveBeenCalledWith({
        queue: 'test',
        fn: 'handler',
        payload: {},
      });
    });
  });

  describe('prepareNextJobAttempt', () => {
    it('increments attempts and returns the new count', async () => {
      mocks.mockGo.mockResolvedValue({ data: { totalAttempts: 2 } });

      const result = await service.prepareNextJobAttempt('job-1');

      expect(result).toBe(2);
      expect(mocks.entity.patch).toHaveBeenCalledWith({ id: 'job-1' });
      expect(mocks.mockSet).toHaveBeenCalledWith({ status: jobStatus.pending });
      expect(mocks.mockAdd).toHaveBeenCalledWith({ totalAttempts: 1 });
      expect(mocks.mockGo).toHaveBeenCalledWith({ response: 'updated_new' });
    });

    it('allows retry unless the job is running or cancelled', async () => {
      mocks.mockGo.mockResolvedValue({ data: { totalAttempts: 2 } });

      await service.prepareNextJobAttempt('job-1');

      const whereFn = mocks.mockWhere.mock.calls[0][0] as (
        attr: { status: string },
        op: { ne: (attr: string, value: string) => string },
      ) => string;
      const ne = vi.fn((_attr: string, value: string) => `#status <> ${value}`);
      const condition = whereFn({ status: 'status' }, { ne });

      expect(ne).toHaveBeenCalledWith('status', jobStatus.running);
      expect(ne).toHaveBeenCalledWith('status', jobStatus.cancelled);
      expect(condition).toBe(
        `#status <> ${jobStatus.running} AND #status <> ${jobStatus.cancelled}`,
      );
    });

    it('returns 1 when totalAttempts is undefined', async () => {
      mocks.mockGo.mockResolvedValue({ data: {} });

      const result = await service.prepareNextJobAttempt('job-1');
      expect(result).toBe(1);
    });

    it('throws NotFoundError on ElectroError', async () => {
      mocks.mockGo.mockRejectedValue(
        new ElectroError(1000, {
          message: 'condition failed',
          sections: {},
        } as unknown as ErrorConstructor),
      );

      await expect(service.prepareNextJobAttempt('job-1')).rejects.toThrow(NotFoundError);
    });

    it('throws non-ElectroError errors', async () => {
      mocks.mockGo.mockRejectedValue(new Error('network error'));

      await expect(service.prepareNextJobAttempt('job-1')).rejects.toThrow('network error');
    });
  });
});
