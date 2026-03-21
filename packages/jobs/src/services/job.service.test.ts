import { ElectroError } from 'electrodb';
import { NotFoundError } from 'http-errors-enhanced';

import { JobErrorCodes } from '../errors';
import { jobStatus } from '../types';

import { createJobService, JobServiceInstance } from './job.service';

function createMockJobEntity() {
  const mockGo = vi.fn();
  const mockSet = vi.fn();
  const mockAdd = vi.fn();
  const mockWhere = vi.fn();

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
  };

  return { entity, mockGo, mockSet, mockAdd, mockWhere };
}

describe('jobService', () => {
  let service: JobServiceInstance;
  let mocks: ReturnType<typeof createMockJobEntity>;

  beforeEach(() => {
    mocks = createMockJobEntity();
    service = createJobService(mocks.entity as any);
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
        } as any),
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
        } as any),
      );

      await expect(
        service.updateJob('job-1', { status: jobStatus.completed }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws non-ElectroError errors', async () => {
      mocks.mockGo.mockRejectedValue(new Error('network error'));

      await expect(
        service.updateJob('job-1', { status: jobStatus.completed }),
      ).rejects.toThrow('network error');
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
      } as any);

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
        } as any),
      );

      await expect(service.prepareNextJobAttempt('job-1')).rejects.toThrow(NotFoundError);
    });

    it('throws non-ElectroError errors', async () => {
      mocks.mockGo.mockRejectedValue(new Error('network error'));

      await expect(service.prepareNextJobAttempt('job-1')).rejects.toThrow('network error');
    });
  });
});
