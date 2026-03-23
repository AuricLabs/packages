vi.mock('@auriclabs/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const mockJobService = vi.hoisted(() => ({
  getJob: vi.fn(),
}));

const mockLambdaExecutorService = vi.hoisted(() => ({
  trigger: vi.fn(),
}));

vi.mock('../init', () => ({
  getJobService: () => mockJobService,
  getLambdaExecutorService: () => mockLambdaExecutorService,
}));

const mockExecuteJob = vi.hoisted(() => vi.fn());

// We need to import JobExecutionError as a real class, not a mock
vi.mock('../helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../helpers')>();
  return {
    ...actual,
    executeJob: (...args: unknown[]) => mockExecuteJob(...args),
  };
});

import { SQSBatchResponse, SQSEvent } from 'aws-lambda';

import { JobExecutionError } from '../helpers';
import { jobStatus } from '../types';

import { createLambdaExecutorHandler } from './lambda-executor';

function createSqsRecord(messageId: string, body: object, arn = 'arn:aws:sqs:us-east-1:123:queue') {
  return {
    messageId,
    body: JSON.stringify(body),
    eventSourceARN: arn,
    receiptHandle: `handle-${messageId}`,
    attributes: {},
    messageAttributes: {},
    md5OfBody: '',
    eventSource: 'aws:sqs',
    awsRegion: 'us-east-1',
  };
}

describe('createLambdaExecutorHandler', () => {
  let handler: (event: SQSEvent) => Promise<SQSBatchResponse>;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = createLambdaExecutorHandler();
  });

  describe('standard queue (non-FIFO)', () => {
    it('processes records in parallel', async () => {
      const job = { id: 'job-1', fn: 'myFn', payload: { data: 1 } };
      mockJobService.getJob.mockResolvedValue(job);
      mockExecuteJob.mockResolvedValue(undefined);

      const event: SQSEvent = {
        Records: [
          createSqsRecord('msg-1', { jobId: 'job-1', queue: 'lambda', attempt: 1 }),
          createSqsRecord('msg-2', { jobId: 'job-1', queue: 'lambda', attempt: 2 }),
        ],
      };

      const response = await handler(event);

      expect(response.batchItemFailures).toEqual([]);
      expect(mockExecuteJob).toHaveBeenCalledTimes(2);
    });

    it('reports batch failures for non-FIFO queue', async () => {
      const job = { id: 'job-1', fn: 'myFn', payload: {} };
      mockJobService.getJob.mockResolvedValue(job);
      mockExecuteJob.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('failed'));

      const event: SQSEvent = {
        Records: [
          createSqsRecord('msg-1', { jobId: 'job-1', queue: 'lambda', attempt: 1 }),
          createSqsRecord('msg-2', { jobId: 'job-1', queue: 'lambda', attempt: 2 }),
        ],
      };

      const response = await handler(event);

      expect(response.batchItemFailures).toEqual([{ itemIdentifier: 'msg-2' }]);
    });

    it('does not report failure for started JobExecutionError', async () => {
      const job = { id: 'job-1', fn: 'myFn', payload: {} };
      mockJobService.getJob.mockResolvedValue(job);

      const executionError = new JobExecutionError(new Error('exec failed'), {
        status: jobStatus.running,
      } as any);
      mockExecuteJob.mockRejectedValue(executionError);

      const event: SQSEvent = {
        Records: [createSqsRecord('msg-1', { jobId: 'job-1', queue: 'lambda', attempt: 1 })],
      };

      const response = await handler(event);

      expect(response.batchItemFailures).toEqual([]);
    });
  });

  describe('FIFO queue', () => {
    const fifoArn = 'arn:aws:sqs:us-east-1:123:queue.fifo';

    it('processes records sequentially', async () => {
      const callOrder: number[] = [];
      const job = { id: 'job-1', fn: 'myFn', payload: {} };
      mockJobService.getJob.mockResolvedValue(job);

      mockExecuteJob
        .mockImplementationOnce(async () => {
          callOrder.push(1);
        })
        .mockImplementationOnce(async () => {
          callOrder.push(2);
        });

      const event: SQSEvent = {
        Records: [
          createSqsRecord('msg-1', { jobId: 'job-1', queue: 'lambda', attempt: 1 }, fifoArn),
          createSqsRecord('msg-2', { jobId: 'job-1', queue: 'lambda', attempt: 2 }, fifoArn),
        ],
      };

      const response = await handler(event);

      expect(callOrder).toEqual([1, 2]);
      expect(response.batchItemFailures).toEqual([]);
    });

    it('stops processing and throws on failure with multiple records', async () => {
      const job = { id: 'job-1', fn: 'myFn', payload: {} };
      mockJobService.getJob.mockResolvedValue(job);

      mockExecuteJob.mockRejectedValueOnce(new Error('processing failed'));

      const event: SQSEvent = {
        Records: [
          createSqsRecord('msg-1', { jobId: 'job-1', queue: 'lambda', attempt: 1 }, fifoArn),
          createSqsRecord('msg-2', { jobId: 'job-1', queue: 'lambda', attempt: 2 }, fifoArn),
        ],
      };

      // Second record hits the `if (failed)` check and throws FAILED STATE
      await expect(handler(event)).rejects.toThrow('FAILED STATE');
    });

    it('throws after processing all records when last one fails', async () => {
      const job = { id: 'job-1', fn: 'myFn', payload: {} };
      mockJobService.getJob.mockResolvedValue(job);

      mockExecuteJob
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('processing failed'));

      const event: SQSEvent = {
        Records: [
          createSqsRecord('msg-1', { jobId: 'job-1', queue: 'lambda', attempt: 1 }, fifoArn),
          createSqsRecord('msg-2', { jobId: 'job-1', queue: 'lambda', attempt: 2 }, fifoArn),
        ],
      };

      await expect(handler(event)).rejects.toThrow('Failed to process event record');
    });

    it('continues on started JobExecutionError in FIFO', async () => {
      const job = { id: 'job-1', fn: 'myFn', payload: {} };
      mockJobService.getJob.mockResolvedValue(job);

      const executionError = new JobExecutionError(new Error('exec failed'), {
        status: jobStatus.running,
      } as any);

      mockExecuteJob.mockRejectedValueOnce(executionError).mockResolvedValueOnce(undefined);

      const event: SQSEvent = {
        Records: [
          createSqsRecord('msg-1', { jobId: 'job-1', queue: 'lambda', attempt: 1 }, fifoArn),
          createSqsRecord('msg-2', { jobId: 'job-1', queue: 'lambda', attempt: 2 }, fifoArn),
        ],
      };

      const response = await handler(event);

      expect(response.batchItemFailures).toEqual([]);
      expect(mockExecuteJob).toHaveBeenCalledTimes(2);
    });
  });
});
