const mockJobEntity = vi.hoisted(() => ({ model: 'job' }));
const mockJobAttemptEntity = vi.hoisted(() => ({ model: 'jobAttempt' }));
const mockJobService = vi.hoisted(() => ({ getJob: vi.fn() }));
const mockJobAttemptService = vi.hoisted(() => ({ scheduleJobAttempt: vi.fn() }));
const mockJobQueueService = vi.hoisted(() => ({ addToQueue: vi.fn() }));
const mockLambdaExecutorService = vi.hoisted(() => ({ trigger: vi.fn() }));

const mockCreateJobModel = vi.hoisted(() => vi.fn(() => mockJobEntity));
const mockCreateJobAttemptModel = vi.hoisted(() => vi.fn(() => mockJobAttemptEntity));
const mockCreateJobService = vi.hoisted(() => vi.fn(() => mockJobService));
const mockCreateJobAttemptService = vi.hoisted(() => vi.fn(() => mockJobAttemptService));
const mockCreateJobQueueService = vi.hoisted(() => vi.fn(() => mockJobQueueService));
const mockCreateLambdaExecutorService = vi.hoisted(() => vi.fn(() => mockLambdaExecutorService));

vi.mock('./models/job.model', () => ({
  createJobModel: mockCreateJobModel,
}));

vi.mock('./models/job-attempt.model', () => ({
  createJobAttemptModel: mockCreateJobAttemptModel,
}));

vi.mock('./services/job.service', () => ({
  createJobService: mockCreateJobService,
}));

vi.mock('./services/job-attempt.service', () => ({
  createJobAttemptService: mockCreateJobAttemptService,
}));

vi.mock('./services/job-queue.service', () => ({
  createJobQueueService: mockCreateJobQueueService,
}));

vi.mock('./services/lambda-executor.service', () => ({
  createLambdaExecutorService: mockCreateLambdaExecutorService,
}));

import {
  initJobs,
  getJobModel,
  getJobAttemptModel,
  getJobService,
  getJobAttemptService,
  getJobQueueService,
  getLambdaExecutorService,
} from './init';

describe('init', () => {
  describe('before initJobs is called', () => {
    it('getJobModel throws', () => {
      expect(() => getJobModel()).toThrow('Call initJobs() before using jobs');
    });

    it('getJobAttemptModel throws', () => {
      expect(() => getJobAttemptModel()).toThrow('Call initJobs() before using jobs');
    });

    it('getJobService throws', () => {
      expect(() => getJobService()).toThrow('Call initJobs() before using jobs');
    });

    it('getJobAttemptService throws', () => {
      expect(() => getJobAttemptService()).toThrow('Call initJobs() before using jobs');
    });

    it('getJobQueueService throws', () => {
      expect(() => getJobQueueService()).toThrow('Call initJobs() before using jobs');
    });

    it('getLambdaExecutorService throws', () => {
      expect(() => getLambdaExecutorService()).toThrow('Call initJobs() before using jobs');
    });
  });

  describe('after initJobs is called', () => {
    beforeEach(() => {
      initJobs({ tableName: 'test-table' });
    });

    it('creates all models and services', () => {
      expect(mockCreateJobModel).toHaveBeenCalledWith('test-table');
      expect(mockCreateJobAttemptModel).toHaveBeenCalledWith('test-table');
      expect(mockCreateJobService).toHaveBeenCalledWith(mockJobEntity);
      expect(mockCreateJobAttemptService).toHaveBeenCalledWith(
        mockJobAttemptEntity,
        mockJobService,
      );
      expect(mockCreateJobQueueService).toHaveBeenCalled();
      expect(mockCreateLambdaExecutorService).toHaveBeenCalled();
    });

    it('getJobModel returns the job entity', () => {
      expect(getJobModel()).toBe(mockJobEntity);
    });

    it('getJobAttemptModel returns the job attempt entity', () => {
      expect(getJobAttemptModel()).toBe(mockJobAttemptEntity);
    });

    it('getJobService returns the job service', () => {
      expect(getJobService()).toBe(mockJobService);
    });

    it('getJobAttemptService returns the job attempt service', () => {
      expect(getJobAttemptService()).toBe(mockJobAttemptService);
    });

    it('getJobQueueService returns the job queue service', () => {
      expect(getJobQueueService()).toBe(mockJobQueueService);
    });

    it('getLambdaExecutorService returns the lambda executor service', () => {
      expect(getLambdaExecutorService()).toBe(mockLambdaExecutorService);
    });
  });
});
