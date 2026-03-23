const { mockSetEventContext } = vi.hoisted(() => ({
  mockSetEventContext: vi.fn(),
}));

vi.mock('@auriclabs/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn() },
}));

vi.mock('./context', () => ({
  setEventContext: mockSetEventContext,
}));

import { logger } from '@auriclabs/logger';

import { createEventListener } from './create-event-listener';

import type { SQSEvent } from 'aws-lambda';

const makeRecord = (body: object, messageId = 'msg-1') => ({
  messageId,
  body: JSON.stringify(body),
  receiptHandle: 'handle',
  attributes: {} as any,
  messageAttributes: {},
  md5OfBody: '',
  eventSource: 'aws:sqs',
  eventSourceARN: 'arn:aws:sqs:us-east-1:123:queue',
  awsRegion: 'us-east-1',
});

const makeEvent = (overrides = {}) => ({
  eventType: 'OrderCreated',
  eventId: 'evt-1',
  aggregateType: 'order',
  aggregateId: 'o-1',
  correlationId: 'corr-1',
  actorId: 'actor-1',
  payload: {},
  ...overrides,
});

describe('createEventListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a function (SQS batch handler)', () => {
    const handler = createEventListener({});
    expect(typeof handler).toBe('function');
  });

  it('parses event from record body and calls matching handler', async () => {
    const orderCreatedHandler = vi.fn();
    const handler = createEventListener({ OrderCreated: orderCreatedHandler });

    const sqsEvent: SQSEvent = {
      Records: [makeRecord(makeEvent())],
    };

    const result = await handler(sqsEvent);

    expect(orderCreatedHandler).toHaveBeenCalledTimes(1);
    expect(orderCreatedHandler).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'OrderCreated' }),
    );
    expect(result.batchItemFailures).toEqual([]);
  });

  it('does not fail when no handler matches the event type', async () => {
    const handler = createEventListener({ SomeOtherEvent: vi.fn() });

    const sqsEvent: SQSEvent = {
      Records: [makeRecord(makeEvent({ eventType: 'UnknownEvent' }))],
    };

    const result = await handler(sqsEvent);

    expect(result.batchItemFailures).toEqual([]);
  });

  it('resolves string aliases to actual handlers', async () => {
    const actualHandler = vi.fn();
    const handler = createEventListener({
      OrderCreated: 'OrderPlaced',
      OrderPlaced: actualHandler,
    });

    const sqsEvent: SQSEvent = {
      Records: [makeRecord(makeEvent({ eventType: 'OrderCreated' }))],
    };

    await handler(sqsEvent);

    expect(actualHandler).toHaveBeenCalledTimes(1);
  });

  it('resolves chained string aliases', async () => {
    const actualHandler = vi.fn();
    const handler = createEventListener({
      OrderCreated: 'AliasOne',
      AliasOne: 'AliasTwo',
      AliasTwo: actualHandler,
    });

    const sqsEvent: SQSEvent = {
      Records: [makeRecord(makeEvent({ eventType: 'OrderCreated' }))],
    };

    await handler(sqsEvent);

    expect(actualHandler).toHaveBeenCalledTimes(1);
  });

  it('sets event context from incoming event', async () => {
    const handler = createEventListener({ OrderCreated: vi.fn() });

    const sqsEvent: SQSEvent = {
      Records: [
        makeRecord(
          makeEvent({
            eventId: 'evt-123',
            correlationId: 'corr-456',
            actorId: 'user-789',
          }),
        ),
      ],
    };

    await handler(sqsEvent);

    expect(mockSetEventContext).toHaveBeenCalledWith({
      causationId: 'evt-123',
      correlationId: 'corr-456',
      actorId: 'user-789',
    });
  });

  it('returns batch failures on handler error', async () => {
    const handler = createEventListener({
      OrderCreated: () => {
        throw new Error('Handler failed');
      },
    });

    const sqsEvent: SQSEvent = {
      Records: [makeRecord(makeEvent(), 'msg-fail')],
    };

    const result = await handler(sqsEvent);

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-fail' }]);
  });

  it('marks subsequent records as failed after first failure (FIFO behavior)', async () => {
    const handler = createEventListener({
      OrderCreated: () => {
        throw new Error('fail');
      },
      OrderUpdated: vi.fn(),
    });

    const sqsEvent: SQSEvent = {
      Records: [
        makeRecord(makeEvent({ eventType: 'OrderCreated' }), 'msg-1'),
        makeRecord(makeEvent({ eventType: 'OrderUpdated' }), 'msg-2'),
        makeRecord(makeEvent({ eventType: 'OrderUpdated' }), 'msg-3'),
      ],
    };

    const result = await handler(sqsEvent);

    expect(result.batchItemFailures).toEqual([
      { itemIdentifier: 'msg-1' },
      { itemIdentifier: 'msg-2' },
      { itemIdentifier: 'msg-3' },
    ]);
  });

  it('logs events in debug mode', async () => {
    const handler = createEventListener({ OrderCreated: vi.fn() }, { debug: true });

    const sqsEvent: SQSEvent = {
      Records: [makeRecord(makeEvent())],
    };

    await handler(sqsEvent);

    expect(logger.debug).toHaveBeenCalledWith(
      { event: expect.objectContaining({ eventType: 'OrderCreated' }) },
      'Processing event',
    );
  });

  it('does not log events when debug is false', async () => {
    const handler = createEventListener({ OrderCreated: vi.fn() }, { debug: false });

    const sqsEvent: SQSEvent = {
      Records: [makeRecord(makeEvent())],
    };

    await handler(sqsEvent);

    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('logs error details when handler fails', async () => {
    const error = new Error('boom');
    const handler = createEventListener({
      OrderCreated: () => {
        throw error;
      },
    });

    const event = makeEvent();
    const sqsEvent: SQSEvent = {
      Records: [makeRecord(event, 'msg-err')],
    };

    await handler(sqsEvent);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error, event: expect.any(Object) }),
      'Error processing event',
    );
  });

  it('handles multiple successful records', async () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    const handler = createEventListener({
      OrderCreated: handlerA,
      OrderUpdated: handlerB,
    });

    const sqsEvent: SQSEvent = {
      Records: [
        makeRecord(makeEvent({ eventType: 'OrderCreated' }), 'msg-1'),
        makeRecord(makeEvent({ eventType: 'OrderUpdated' }), 'msg-2'),
      ],
    };

    const result = await handler(sqsEvent);

    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).toHaveBeenCalledTimes(1);
    expect(result.batchItemFailures).toEqual([]);
  });
});
