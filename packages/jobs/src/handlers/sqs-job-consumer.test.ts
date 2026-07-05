vi.mock('@auriclabs/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { SQSEvent } from 'aws-lambda';

import { JobExecutionError } from '../helpers';
import { JobItem } from '../models';
import { jobStatus } from '../types';

import { createSqsJobConsumer } from './sqs-job-consumer';

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

const fifoArn = 'arn:aws:sqs:us-east-1:123:queue.fifo';

describe('createSqsJobConsumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses the message body and passes it with the record', async () => {
    const processRecord = vi.fn().mockResolvedValue(undefined);
    const handler = createSqsJobConsumer(processRecord);

    const event: SQSEvent = {
      Records: [createSqsRecord('msg-1', { jobId: 'job-1', queue: 'lambda', attempt: 1 })],
    };

    await handler(event);

    expect(processRecord).toHaveBeenCalledWith(
      { jobId: 'job-1', queue: 'lambda', attempt: 1 },
      expect.objectContaining({ messageId: 'msg-1' }),
    );
  });

  it('reports partial batch failures on standard queues', async () => {
    const processRecord = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('failed'));
    const handler = createSqsJobConsumer(processRecord);

    const event: SQSEvent = {
      Records: [
        createSqsRecord('msg-1', { jobId: 'job-1', queue: 'lambda', attempt: 1 }),
        createSqsRecord('msg-2', { jobId: 'job-1', queue: 'lambda', attempt: 2 }),
      ],
    };

    const response = await handler(event);

    expect(response.batchItemFailures).toEqual([{ itemIdentifier: 'msg-2' }]);
  });

  it('swallows started JobExecutionError', async () => {
    const executionError = new JobExecutionError(new Error('exec failed'), {
      status: jobStatus.running,
    } as unknown as JobItem);
    const processRecord = vi.fn().mockRejectedValue(executionError);
    const handler = createSqsJobConsumer(processRecord);

    const event: SQSEvent = {
      Records: [createSqsRecord('msg-1', { jobId: 'job-1', queue: 'lambda', attempt: 1 })],
    };

    const response = await handler(event);

    expect(response.batchItemFailures).toEqual([]);
  });

  it('processes FIFO queues sequentially and throws on failure', async () => {
    const processRecord = vi.fn().mockRejectedValueOnce(new Error('processing failed'));
    const handler = createSqsJobConsumer(processRecord);

    const event: SQSEvent = {
      Records: [
        createSqsRecord('msg-1', { jobId: 'job-1', queue: 'lambda', attempt: 1 }, fifoArn),
        createSqsRecord('msg-2', { jobId: 'job-1', queue: 'lambda', attempt: 2 }, fifoArn),
      ],
    };

    await expect(handler(event)).rejects.toThrow('FAILED STATE');
    expect(processRecord).toHaveBeenCalledTimes(1);
  });

  it('continues past started JobExecutionError on FIFO queues', async () => {
    const executionError = new JobExecutionError(new Error('exec failed'), {
      status: jobStatus.running,
    } as unknown as JobItem);
    const processRecord = vi
      .fn()
      .mockRejectedValueOnce(executionError)
      .mockResolvedValueOnce(undefined);
    const handler = createSqsJobConsumer(processRecord);

    const event: SQSEvent = {
      Records: [
        createSqsRecord('msg-1', { jobId: 'job-1', queue: 'lambda', attempt: 1 }, fifoArn),
        createSqsRecord('msg-2', { jobId: 'job-1', queue: 'lambda', attempt: 2 }, fifoArn),
      ],
    };

    const response = await handler(event);

    expect(response.batchItemFailures).toEqual([]);
    expect(processRecord).toHaveBeenCalledTimes(2);
  });
});
