const { mockSqsSend, mockEbSend, mockUnmarshall } = vi.hoisted(() => ({
  mockSqsSend: vi.fn(),
  mockEbSend: vi.fn(),
  mockUnmarshall: vi.fn(),
}));

vi.mock('@auriclabs/logger', () => ({
  logger: { error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: vi.fn(() => ({ send: mockSqsSend })),
  SendMessageBatchCommand: vi.fn((input: unknown) => ({ input, _type: 'SendMessageBatch' })),
}));

vi.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: vi.fn(() => ({ send: mockEbSend })),
  PutEventsCommand: vi.fn((input: unknown) => ({ input, _type: 'PutEvents' })),
}));

vi.mock('@aws-sdk/util-dynamodb', () => ({
  unmarshall: mockUnmarshall,
}));

vi.mock('lodash-es', () => ({
  kebabCase: vi.fn((s: string) => s.toLowerCase().replace(/[.\s]+/g, '-')),
}));

import { logger } from '@auriclabs/logger';
import { PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { SendMessageBatchCommand } from '@aws-sdk/client-sqs';

import { createStreamHandler } from './stream-handler';

import type { DynamoDBStreamEvent } from 'aws-lambda';

const makeEventRecord = (overrides = {}) => ({
  pk: 'AGG#order#o-1',
  sk: 'EVT#000000001',
  itemType: 'event' as const,
  source: 'order-service',
  aggregateId: 'o-1',
  aggregateType: 'order',
  version: 1,
  eventId: 'evt-1',
  eventType: 'OrderCreated',
  schemaVersion: 1,
  occurredAt: '2025-01-01T00:00:00.000Z',
  payload: {},
  ...overrides,
});

const makeStreamRecord = (eventName: string, newImage: object | undefined = {}) => ({
  eventID: '1',
  eventVersion: '1.1',
  dynamodb: {
    NewImage: newImage,
    StreamViewType: 'NEW_IMAGE',
  },
  awsRegion: 'us-east-1',
  eventName,
  eventSourceARN: 'arn:aws:dynamodb:us-east-1:123:table/events/stream',
  eventSource: 'aws:dynamodb',
});

describe('stream-handler', () => {
  const config = {
    busName: 'test-bus',
    queueUrls: ['https://sqs.us-east-1.amazonaws.com/123/queue-1'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSqsSend.mockResolvedValue({});
    mockEbSend.mockResolvedValue({});
  });

  it('returns a Lambda handler function', () => {
    const handler = createStreamHandler(config);
    expect(typeof handler).toBe('function');
  });

  it('filters INSERT events only', async () => {
    const eventRecord = makeEventRecord();
    mockUnmarshall.mockReturnValue(eventRecord);

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [
        makeStreamRecord('INSERT', { data: { S: 'x' } }),
        makeStreamRecord('MODIFY', { data: { S: 'y' } }),
        makeStreamRecord('REMOVE', undefined),
      ] as any,
    };

    await handler(event);

    // Only the INSERT record should be unmarshalled and sent
    expect(mockUnmarshall).toHaveBeenCalledTimes(1);
  });

  it('filters for itemType event only', async () => {
    const headRecord = { pk: 'AGG#order#o-1', sk: 'HEAD', itemType: 'head' };
    const eventRecord = makeEventRecord();

    mockUnmarshall.mockReturnValueOnce(headRecord).mockReturnValueOnce(eventRecord);

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [
        makeStreamRecord('INSERT', { a: { S: '1' } }),
        makeStreamRecord('INSERT', { b: { S: '2' } }),
      ] as any,
    };

    await handler(event);

    // Only eventRecord (itemType='event') should be sent
    expect(SendMessageBatchCommand).toHaveBeenCalledTimes(1);
    const sqsInput = vi.mocked(SendMessageBatchCommand).mock.calls[0][0];
    expect(sqsInput.Entries).toHaveLength(1);
    expect(JSON.parse(sqsInput.Entries![0].MessageBody)).toEqual(eventRecord);
  });

  it('sends to all configured queues', async () => {
    const eventRecord = makeEventRecord();
    mockUnmarshall.mockReturnValue(eventRecord);

    const multiQueueConfig = {
      busName: 'test-bus',
      queueUrls: [
        'https://sqs.us-east-1.amazonaws.com/123/queue-1',
        'https://sqs.us-east-1.amazonaws.com/123/queue-2',
      ],
    };

    const handler = createStreamHandler(multiQueueConfig);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })] as any,
    };

    await handler(event);

    expect(SendMessageBatchCommand).toHaveBeenCalledTimes(2);
    const call1 = vi.mocked(SendMessageBatchCommand).mock.calls[0][0];
    const call2 = vi.mocked(SendMessageBatchCommand).mock.calls[1][0];
    expect(call1.QueueUrl).toBe('https://sqs.us-east-1.amazonaws.com/123/queue-1');
    expect(call2.QueueUrl).toBe('https://sqs.us-east-1.amazonaws.com/123/queue-2');
  });

  it('sends to EventBridge with correct bus name and detail type', async () => {
    const eventRecord = makeEventRecord({ source: 'billing', eventType: 'CreditAdded' });
    mockUnmarshall.mockReturnValue(eventRecord);

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })] as any,
    };

    await handler(event);

    expect(PutEventsCommand).toHaveBeenCalledTimes(1);
    const ebInput = vi.mocked(PutEventsCommand).mock.calls[0][0];
    expect(ebInput.Entries).toHaveLength(1);
    expect(ebInput.Entries![0].EventBusName).toBe('test-bus');
    expect(ebInput.Entries![0].DetailType).toBe('CreditAdded');
    expect(ebInput.Entries![0].Source).toBe('billing');
    expect(JSON.parse(ebInput.Entries![0].Detail)).toEqual(eventRecord);
  });

  it('uses kebabCase of aggregateType as source fallback when source is undefined', async () => {
    const eventRecord = makeEventRecord({ source: undefined, aggregateType: 'Order.Item' });
    mockUnmarshall.mockReturnValue(eventRecord);

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })] as any,
    };

    await handler(event);

    const ebInput = vi.mocked(PutEventsCommand).mock.calls[0][0];
    // kebabCase splits on '.', takes first part 'Order', which becomes 'order'
    expect(ebInput.Entries![0].Source).toBe('order');
  });

  it('uses aggregateId as MessageGroupId', async () => {
    const eventRecord = makeEventRecord({ aggregateId: 'agg-123' });
    mockUnmarshall.mockReturnValue(eventRecord);

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })] as any,
    };

    await handler(event);

    const sqsInput = vi.mocked(SendMessageBatchCommand).mock.calls[0][0];
    expect(sqsInput.Entries![0].MessageGroupId).toBe('agg-123');
  });

  it('uses eventId as MessageDeduplicationId', async () => {
    const eventRecord = makeEventRecord({ eventId: 'evt-dedup-1' });
    mockUnmarshall.mockReturnValue(eventRecord);

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })] as any,
    };

    await handler(event);

    const sqsInput = vi.mocked(SendMessageBatchCommand).mock.calls[0][0];
    expect(sqsInput.Entries![0].MessageDeduplicationId).toBe('evt-dedup-1');
  });

  it('batches correctly (respects BATCH_SIZE of 10)', async () => {
    // Create 12 event records to trigger 2 batches
    const records = Array.from({ length: 12 }, (_, i) =>
      makeEventRecord({ eventId: `evt-${i}`, version: i + 1 }),
    );

    mockUnmarshall.mockImplementation((_, i) => records[i]);
    // Reset to return each record in sequence
    mockUnmarshall.mockReset();
    records.forEach((r) => mockUnmarshall.mockReturnValueOnce(r));

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: records.map((_, i) => makeStreamRecord('INSERT', { idx: { N: String(i) } })) as any,
    };

    await handler(event);

    // 2 batches for SQS (10 + 2), 1 queue = 2 calls
    expect(SendMessageBatchCommand).toHaveBeenCalledTimes(2);
    const firstBatch = vi.mocked(SendMessageBatchCommand).mock.calls[0][0];
    const secondBatch = vi.mocked(SendMessageBatchCommand).mock.calls[1][0];
    expect(firstBatch.Entries).toHaveLength(10);
    expect(secondBatch.Entries).toHaveLength(2);

    // 2 batches for EventBridge (10 + 2)
    expect(PutEventsCommand).toHaveBeenCalledTimes(2);
  });

  it('handles unmarshall errors gracefully', async () => {
    mockUnmarshall.mockImplementation(() => {
      throw new Error('unmarshall failed');
    });

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { bad: { S: 'data' } })] as any,
    };

    await handler(event);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      'Error unmarshalling event record',
    );
    // Should not send to queues since no valid records
    expect(SendMessageBatchCommand).not.toHaveBeenCalled();
    expect(PutEventsCommand).not.toHaveBeenCalled();
  });

  it('does nothing when there are no event records', async () => {
    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = { Records: [] };

    await handler(event);

    expect(SendMessageBatchCommand).not.toHaveBeenCalled();
    expect(PutEventsCommand).not.toHaveBeenCalled();
  });

  it('re-throws SQS send errors', async () => {
    const eventRecord = makeEventRecord();
    mockUnmarshall.mockReturnValue(eventRecord);
    mockSqsSend.mockRejectedValue(new Error('SQS error'));

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })] as any,
    };

    await expect(handler(event)).rejects.toThrow('SQS error');
    expect(logger.error).toHaveBeenCalled();
  });

  it('re-throws EventBridge send errors', async () => {
    const eventRecord = makeEventRecord();
    mockUnmarshall.mockReturnValue(eventRecord);
    mockEbSend.mockRejectedValue(new Error('EB error'));

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })] as any,
    };

    await expect(handler(event)).rejects.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});
