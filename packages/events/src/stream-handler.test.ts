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

import type { DynamoDBRecord, DynamoDBStreamEvent } from 'aws-lambda';

const makeEventRecord = (overrides = {}) => ({
  pk: 'AGG#order#o-1',
  sk: 'EVT#000000001',
  itemType: 'event' as const,
  source: 'order-service',
  aggregateId: 'o-1',
  aggregateType: 'order',
  version: 1,
  tenantId: 'tenant-1',
  eventId: 'evt-1',
  eventType: 'OrderCreated',
  schemaVersion: 1,
  occurredAt: '2025-01-01T00:00:00.000Z',
  payload: {},
  ...overrides,
});

const makeStreamRecord = (
  eventName: string,
  newImage: object | undefined = {},
): DynamoDBRecord => ({
  eventID: '1',
  eventVersion: '1.1',
  dynamodb: {
    NewImage: newImage as DynamoDBRecord['dynamodb'] extends infer D
      ? D extends { NewImage?: infer N }
        ? N
        : never
      : never,
    StreamViewType: 'NEW_IMAGE',
  },
  awsRegion: 'us-east-1',
  eventName,
  eventSourceARN: 'arn:aws:dynamodb:us-east-1:123:table/events/stream',
  eventSource: 'aws:dynamodb',
});

interface SqsBatchInput {
  QueueUrl?: string;
  Entries?: {
    Id?: string;
    MessageBody: string;
    MessageGroupId?: string;
    MessageDeduplicationId?: string;
  }[];
}

interface EbPutEventsInput {
  Entries?: {
    EventBusName?: string;
    DetailType?: string;
    Source?: string;
    Detail: string;
  }[];
}

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
      ],
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
      ],
    };

    await handler(event);

    // Only eventRecord (itemType='event') should be sent
    expect(SendMessageBatchCommand).toHaveBeenCalledTimes(1);
    const sqsInput = vi.mocked(SendMessageBatchCommand).mock.calls[0][0] as SqsBatchInput;
    expect(sqsInput.Entries).toHaveLength(1);
    expect(JSON.parse(sqsInput.Entries?.[0]?.MessageBody ?? '')).toEqual(eventRecord);
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
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })],
    };

    await handler(event);

    expect(SendMessageBatchCommand).toHaveBeenCalledTimes(2);
    const call1 = vi.mocked(SendMessageBatchCommand).mock.calls[0][0] as SqsBatchInput;
    const call2 = vi.mocked(SendMessageBatchCommand).mock.calls[1][0] as SqsBatchInput;
    expect(call1.QueueUrl).toBe('https://sqs.us-east-1.amazonaws.com/123/queue-1');
    expect(call2.QueueUrl).toBe('https://sqs.us-east-1.amazonaws.com/123/queue-2');
  });

  it('sends to EventBridge with correct bus name and detail type', async () => {
    const eventRecord = makeEventRecord({ source: 'billing', eventType: 'CreditAdded' });
    mockUnmarshall.mockReturnValue(eventRecord);

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })],
    };

    await handler(event);

    expect(PutEventsCommand).toHaveBeenCalledTimes(1);
    const ebInput = vi.mocked(PutEventsCommand).mock.calls[0][0] as EbPutEventsInput;
    expect(ebInput.Entries).toHaveLength(1);
    expect(ebInput.Entries?.[0]?.EventBusName).toBe('test-bus');
    expect(ebInput.Entries?.[0]?.DetailType).toBe('CreditAdded');
    expect(ebInput.Entries?.[0]?.Source).toBe('billing');
    expect(JSON.parse(ebInput.Entries?.[0]?.Detail ?? '')).toEqual(eventRecord);
  });

  it('uses kebabCase of aggregateType as source fallback when source is undefined', async () => {
    const eventRecord = makeEventRecord({ source: undefined, aggregateType: 'Order.Item' });
    mockUnmarshall.mockReturnValue(eventRecord);

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })],
    };

    await handler(event);

    const ebInput = vi.mocked(PutEventsCommand).mock.calls[0][0] as EbPutEventsInput;
    // kebabCase splits on '.', takes first part 'Order', which becomes 'order'
    expect(ebInput.Entries?.[0]?.Source).toBe('order');
  });

  it('uses aggregateId as MessageGroupId on FIFO queues', async () => {
    const eventRecord = makeEventRecord({ aggregateId: 'agg-123' });
    mockUnmarshall.mockReturnValue(eventRecord);

    const fifoConfig = {
      busName: 'test-bus',
      queueUrls: ['https://sqs.us-east-1.amazonaws.com/123/queue-1.fifo'],
    };
    const handler = createStreamHandler(fifoConfig);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })],
    };

    await handler(event);

    const sqsInput = vi.mocked(SendMessageBatchCommand).mock.calls[0][0] as SqsBatchInput;
    expect(sqsInput.Entries?.[0]?.MessageGroupId).toBe('agg-123');
  });

  it('uses eventId as MessageDeduplicationId on FIFO queues', async () => {
    const eventRecord = makeEventRecord({ eventId: 'evt-dedup-1' });
    mockUnmarshall.mockReturnValue(eventRecord);

    const fifoConfig = {
      busName: 'test-bus',
      queueUrls: ['https://sqs.us-east-1.amazonaws.com/123/queue-1.fifo'],
    };
    const handler = createStreamHandler(fifoConfig);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })],
    };

    await handler(event);

    const sqsInput = vi.mocked(SendMessageBatchCommand).mock.calls[0][0] as SqsBatchInput;
    expect(sqsInput.Entries?.[0]?.MessageDeduplicationId).toBe('evt-dedup-1');
  });

  it('omits MessageGroupId and MessageDeduplicationId on standard queues', async () => {
    const eventRecord = makeEventRecord({ aggregateId: 'agg-123', eventId: 'evt-dedup-1' });
    mockUnmarshall.mockReturnValue(eventRecord);

    // Standard queue URL (no `.fifo` suffix). FIFO-only attributes must be omitted
    // — including them causes SQS to reject the entries with InvalidParameterValue
    // and silently drop messages.
    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })],
    };

    await handler(event);

    const sqsInput = vi.mocked(SendMessageBatchCommand).mock.calls[0][0] as SqsBatchInput;
    expect(sqsInput.Entries?.[0]?.MessageGroupId).toBeUndefined();
    expect(sqsInput.Entries?.[0]?.MessageDeduplicationId).toBeUndefined();
  });

  it('throws when SQS SendMessageBatch returns Failed[] entries', async () => {
    const eventRecord = makeEventRecord();
    mockUnmarshall.mockReturnValue(eventRecord);
    mockSqsSend.mockResolvedValue({
      Successful: [],
      Failed: [
        {
          Id: 'evt-1-0',
          Code: 'InvalidParameterValue',
          SenderFault: true,
          Message: 'provider-failure-secret-marker',
        },
      ],
    });

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })],
    };

    await expect(handler(event)).rejects.toThrow('SQS batch send failed');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        queueIndex: 0,
        failedCount: 1,
        senderFaultCount: 1,
      }),
      'SQS batch had failed entries',
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      'provider-failure-secret-marker',
    );
  });

  it('error logs omit event fields and thrown error text', async () => {
    const eventRecord = makeEventRecord({
      eventId: 'event-id-secret-marker',
      aggregateId: 'aggregate-id-secret-marker',
      eventType: 'event-type-secret-marker',
      payload: { secret: 'pii-do-not-log' },
    });
    mockUnmarshall.mockReturnValue(eventRecord);
    mockSqsSend.mockRejectedValue(new Error('sdk-error-secret-marker'));

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })],
    };

    await expect(handler(event)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      { queueIndex: 0, batchSize: 1 },
      'Error sending batch to queue',
    );
    const logged = JSON.stringify(vi.mocked(logger.error).mock.calls);
    for (const secret of [
      'pii-do-not-log',
      'event-id-secret-marker',
      'aggregate-id-secret-marker',
      'event-type-secret-marker',
      'sdk-error-secret-marker',
    ]) {
      expect(logged).not.toContain(secret);
    }
  });

  it('throws when EventBridge PutEvents returns FailedEntryCount > 0', async () => {
    const eventRecord = makeEventRecord();
    mockUnmarshall.mockReturnValue(eventRecord);
    mockEbSend.mockResolvedValue({
      FailedEntryCount: 1,
      Entries: [{ ErrorCode: 'InternalException', ErrorMessage: 'eventbridge-secret-marker' }],
    });

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })],
    };

    await expect(handler(event)).rejects.toThrow('EventBridge batch send failed');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        failedCount: 1,
        batchSize: 1,
      }),
      'EventBridge PutEvents had failed entries',
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      'eventbridge-secret-marker',
    );
  });

  it('batches correctly (respects BATCH_SIZE of 10)', async () => {
    // Create 12 event records to trigger 2 batches
    const records = Array.from({ length: 12 }, (_, i) =>
      makeEventRecord({ eventId: `evt-${String(i)}`, version: i + 1 }),
    );

    mockUnmarshall.mockReset();
    records.forEach((r) => mockUnmarshall.mockReturnValueOnce(r));

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: records.map((_r, i) => makeStreamRecord('INSERT', { idx: { N: String(i) } })),
    };

    await handler(event);

    // 2 batches for SQS (10 + 2), 1 queue = 2 calls
    expect(SendMessageBatchCommand).toHaveBeenCalledTimes(2);
    const firstBatch = vi.mocked(SendMessageBatchCommand).mock.calls[0][0] as SqsBatchInput;
    const secondBatch = vi.mocked(SendMessageBatchCommand).mock.calls[1][0] as SqsBatchInput;
    expect(firstBatch.Entries).toHaveLength(10);
    expect(secondBatch.Entries).toHaveLength(2);

    // 2 batches for EventBridge (10 + 2)
    expect(PutEventsCommand).toHaveBeenCalledTimes(2);
  });

  it('handles unmarshall errors gracefully', async () => {
    mockUnmarshall.mockImplementation(() => {
      throw new Error('unmarshall-error-secret-marker');
    });

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { bad: { S: 'stream-record-secret-marker' } })],
    };

    await handler(event);

    expect(logger.error).toHaveBeenCalledWith(
      { recordIndex: 0 },
      'Error unmarshalling event record',
    );
    const logged = JSON.stringify(vi.mocked(logger.error).mock.calls);
    expect(logged).not.toContain('unmarshall-error-secret-marker');
    expect(logged).not.toContain('stream-record-secret-marker');
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

  it('rethrows a fixed SQS error without SDK text', async () => {
    const eventRecord = makeEventRecord();
    mockUnmarshall.mockReturnValue(eventRecord);
    mockSqsSend.mockRejectedValue(new Error('sqs-sdk-secret-marker'));

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })],
    };

    await expect(handler(event)).rejects.toThrow('SQS batch send failed');
    expect(logger.error).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      'sqs-sdk-secret-marker',
    );
  });

  it('skips EventBridge when busName is omitted', async () => {
    const eventRecord = makeEventRecord();
    mockUnmarshall.mockReturnValue(eventRecord);

    const handler = createStreamHandler({
      queueUrls: ['https://sqs.us-east-1.amazonaws.com/123/queue-1'],
    });
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })],
    };

    await handler(event);

    expect(SendMessageBatchCommand).toHaveBeenCalledTimes(1);
    expect(PutEventsCommand).not.toHaveBeenCalled();
  });

  it('skips EventBridge when busName is empty string', async () => {
    const eventRecord = makeEventRecord();
    mockUnmarshall.mockReturnValue(eventRecord);

    const handler = createStreamHandler({
      busName: '',
      queueUrls: ['https://sqs.us-east-1.amazonaws.com/123/queue-1'],
    });
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })],
    };

    await handler(event);

    expect(SendMessageBatchCommand).toHaveBeenCalledTimes(1);
    expect(PutEventsCommand).not.toHaveBeenCalled();
  });

  it('rethrows a fixed EventBridge error without SDK text', async () => {
    const eventRecord = makeEventRecord();
    mockUnmarshall.mockReturnValue(eventRecord);
    mockEbSend.mockRejectedValue(new Error('eventbridge-sdk-secret-marker'));

    const handler = createStreamHandler(config);
    const event: DynamoDBStreamEvent = {
      Records: [makeStreamRecord('INSERT', { a: { S: '1' } })],
    };

    await expect(handler(event)).rejects.toThrow('EventBridge batch send failed');
    expect(logger.error).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      'eventbridge-sdk-secret-marker',
    );
  });
});
