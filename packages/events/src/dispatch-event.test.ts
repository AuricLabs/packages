const { mockGetEventService, mockGetHead, mockAppendEvent, mockGetEventContext, mockUlid } =
  vi.hoisted(() => ({
    mockGetEventService: vi.fn(),
    mockGetHead: vi.fn(),
    mockAppendEvent: vi.fn(),
    mockGetEventContext: vi.fn(),
    mockUlid: vi.fn(),
  }));

vi.mock('./init', () => ({
  getEventService: mockGetEventService,
}));

vi.mock('./context', () => ({
  getEventContext: mockGetEventContext,
}));

vi.mock('@auriclabs/api-core', () => ({
  retry: vi.fn((fn: () => unknown) => fn()),
}));

vi.mock('@auriclabs/logger', () => ({
  logger: { debug: vi.fn() },
}));

vi.mock('ulid', () => ({
  ulid: mockUlid,
}));

import { dispatchEvent } from './dispatch-event';
import { retry } from '@auriclabs/api-core';

describe('dispatchEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEventService.mockReturnValue({
      getHead: mockGetHead,
      appendEvent: mockAppendEvent,
    });
    mockGetEventContext.mockReturnValue({});
    mockGetHead.mockResolvedValue(undefined);
    mockAppendEvent.mockResolvedValue({ pk: 'AGG#test#1', sk: 'EVT#000000001', version: 1 });
    mockUlid.mockReturnValue('01ARZ3NDEKTSV4RRFFQ69G5FAV');
  });

  it('generates eventId with ulid prefix when not provided', async () => {
    await dispatchEvent({
      aggregateType: 'order',
      aggregateId: 'o-1',
      source: 'test',
      eventType: 'OrderCreated',
    });

    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-01ARZ3NDEKTSV4RRFFQ69G5FAV',
      }),
    );
  });

  it('uses provided eventId when given', async () => {
    await dispatchEvent({
      aggregateType: 'order',
      aggregateId: 'o-1',
      source: 'test',
      eventType: 'OrderCreated',
      eventId: 'custom-event-id',
    });

    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'custom-event-id',
      }),
    );
  });

  it('uses provided idempotencyKey when given', async () => {
    await dispatchEvent({
      aggregateType: 'order',
      aggregateId: 'o-1',
      source: 'test',
      eventType: 'OrderCreated',
      idempotencyKey: 'my-idem-key',
    });

    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'my-idem-key',
      }),
    );
  });

  it('defaults idempotencyKey to eventId when not provided', async () => {
    await dispatchEvent({
      aggregateType: 'order',
      aggregateId: 'o-1',
      source: 'test',
      eventType: 'OrderCreated',
    });

    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'evt-01ARZ3NDEKTSV4RRFFQ69G5FAV',
      }),
    );
  });

  it('reads head version before appending', async () => {
    mockGetHead.mockResolvedValue({ currentVersion: 5 });

    await dispatchEvent({
      aggregateType: 'order',
      aggregateId: 'o-1',
      source: 'test',
      eventType: 'OrderUpdated',
    });

    expect(mockGetHead).toHaveBeenCalledWith('order', 'o-1');
    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 5,
      }),
    );
  });

  it('uses expectedVersion 0 when head does not exist', async () => {
    mockGetHead.mockResolvedValue(undefined);

    await dispatchEvent({
      aggregateType: 'order',
      aggregateId: 'o-1',
      source: 'test',
      eventType: 'OrderCreated',
    });

    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 0,
      }),
    );
  });

  it('merges event context into append args', async () => {
    mockGetEventContext.mockReturnValue({
      correlationId: 'ctx-corr-1',
      actorId: 'ctx-actor-1',
    });

    await dispatchEvent({
      aggregateType: 'order',
      aggregateId: 'o-1',
      source: 'test',
      eventType: 'OrderCreated',
    });

    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'ctx-corr-1',
        actorId: 'ctx-actor-1',
      }),
    );
  });

  it('event args override event context', async () => {
    mockGetEventContext.mockReturnValue({
      correlationId: 'ctx-corr',
      actorId: 'ctx-actor',
    });

    await dispatchEvent({
      aggregateType: 'order',
      aggregateId: 'o-1',
      source: 'test',
      eventType: 'OrderCreated',
      correlationId: 'event-corr',
    });

    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'event-corr',
        actorId: 'ctx-actor',
      }),
    );
  });

  it('calls retry wrapper', async () => {
    await dispatchEvent({
      aggregateType: 'order',
      aggregateId: 'o-1',
      source: 'test',
      eventType: 'OrderCreated',
    });

    expect(retry).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledWith(expect.any(Function));
  });

  it('sets schemaVersion to 1', async () => {
    await dispatchEvent({
      aggregateType: 'order',
      aggregateId: 'o-1',
      source: 'test',
      eventType: 'OrderCreated',
    });

    expect(mockAppendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 1,
      }),
    );
  });

  it('returns the appendEvent result', async () => {
    const expected = { pk: 'AGG#order#o-1', sk: 'EVT#000000001', version: 1 };
    mockAppendEvent.mockResolvedValue(expected);

    const result = await dispatchEvent({
      aggregateType: 'order',
      aggregateId: 'o-1',
      source: 'test',
      eventType: 'OrderCreated',
    });

    expect(result).toEqual(expected);
  });
});
