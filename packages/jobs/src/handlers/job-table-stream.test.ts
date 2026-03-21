import { marshall } from '@aws-sdk/util-dynamodb';
import { DynamoDBStreamEvent } from 'aws-lambda';

const mockJobService = {
  getJob: vi.fn(),
};

const mockJobQueueService = {
  addToQueue: vi.fn(),
};

vi.mock('../init', () => ({
  getJobService: () => mockJobService,
  getJobQueueService: () => mockJobQueueService,
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  unmarshall: vi.fn((item: unknown) => item),
}));

import { createJobTableStreamHandler } from './job-table-stream';

describe('createJobTableStreamHandler', () => {
  let handler: (event: DynamoDBStreamEvent) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = createJobTableStreamHandler();
  });

  it('queues job attempt on INSERT', async () => {
    const jobAttempt = { jobId: 'job-1', attempt: 1, scheduledAt: '2025-01-01T00:00:00Z' };
    const mockJob = { id: 'job-1', queue: 'lambda' };

    mockJobService.getJob.mockResolvedValue(mockJob);
    mockJobQueueService.addToQueue.mockResolvedValue('msg-1');

    const event: DynamoDBStreamEvent = {
      Records: [
        {
          eventName: 'INSERT',
          dynamodb: {
            NewImage: jobAttempt as any,
          },
        } as any,
      ],
    };

    await handler(event);

    expect(mockJobService.getJob).toHaveBeenCalledWith('job-1');
    expect(mockJobQueueService.addToQueue).toHaveBeenCalledWith(
      'lambda',
      'job-1',
      1,
      '2025-01-01T00:00:00Z',
    );
  });

  it('re-queues on MODIFY when scheduledAt changes', async () => {
    const prevAttempt = { jobId: 'job-1', attempt: 1, scheduledAt: '2025-01-01T00:00:00Z' };
    const newAttempt = { jobId: 'job-1', attempt: 1, scheduledAt: '2025-02-01T00:00:00Z' };
    const mockJob = { id: 'job-1', queue: 'lambda' };

    mockJobService.getJob.mockResolvedValue(mockJob);
    mockJobQueueService.addToQueue.mockResolvedValue('msg-1');

    const event: DynamoDBStreamEvent = {
      Records: [
        {
          eventName: 'MODIFY',
          dynamodb: {
            OldImage: prevAttempt as any,
            NewImage: newAttempt as any,
          },
        } as any,
      ],
    };

    await handler(event);

    expect(mockJobService.getJob).toHaveBeenCalledWith('job-1');
    expect(mockJobQueueService.addToQueue).toHaveBeenCalledWith(
      'lambda',
      'job-1',
      1,
      '2025-02-01T00:00:00Z',
    );
  });

  it('skips MODIFY when scheduledAt is unchanged', async () => {
    const prevAttempt = { jobId: 'job-1', attempt: 1, scheduledAt: '2025-01-01T00:00:00Z' };
    const newAttempt = { jobId: 'job-1', attempt: 1, scheduledAt: '2025-01-01T00:00:00Z' };

    const event: DynamoDBStreamEvent = {
      Records: [
        {
          eventName: 'MODIFY',
          dynamodb: {
            OldImage: prevAttempt as any,
            NewImage: newAttempt as any,
          },
        } as any,
      ],
    };

    await handler(event);

    expect(mockJobService.getJob).not.toHaveBeenCalled();
    expect(mockJobQueueService.addToQueue).not.toHaveBeenCalled();
  });

  it('handles REMOVE events by doing nothing', async () => {
    const event: DynamoDBStreamEvent = {
      Records: [
        {
          eventName: 'REMOVE',
          dynamodb: {},
        } as any,
      ],
    };

    await handler(event);

    expect(mockJobService.getJob).not.toHaveBeenCalled();
    expect(mockJobQueueService.addToQueue).not.toHaveBeenCalled();
  });

  it('processes multiple records', async () => {
    const attempt1 = { jobId: 'job-1', attempt: 1, scheduledAt: undefined };
    const attempt2 = { jobId: 'job-2', attempt: 1, scheduledAt: undefined };
    const mockJob1 = { id: 'job-1', queue: 'lambda' };
    const mockJob2 = { id: 'job-2', queue: 'other' };

    mockJobService.getJob
      .mockResolvedValueOnce(mockJob1)
      .mockResolvedValueOnce(mockJob2);
    mockJobQueueService.addToQueue.mockResolvedValue('msg-1');

    const event: DynamoDBStreamEvent = {
      Records: [
        {
          eventName: 'INSERT',
          dynamodb: { NewImage: attempt1 as any },
        } as any,
        {
          eventName: 'INSERT',
          dynamodb: { NewImage: attempt2 as any },
        } as any,
      ],
    };

    await handler(event);

    expect(mockJobService.getJob).toHaveBeenCalledTimes(2);
    expect(mockJobQueueService.addToQueue).toHaveBeenCalledTimes(2);
  });
});
