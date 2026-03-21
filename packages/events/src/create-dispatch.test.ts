const { mockDispatchEvent, mockGetEventContext, mockUlid } = vi.hoisted(() => ({
  mockDispatchEvent: vi.fn(),
  mockGetEventContext: vi.fn(),
  mockUlid: vi.fn(),
}));

vi.mock('./dispatch-event', () => ({
  dispatchEvent: mockDispatchEvent,
}));

vi.mock('./context', () => ({
  getEventContext: mockGetEventContext,
}));

vi.mock('ulid', () => ({
  ulid: mockUlid,
}));

import { createDispatch } from './create-dispatch';

describe('createDispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEventContext.mockReturnValue({});
    mockUlid.mockReturnValue('01ARZ3NDEKTSV4RRFFQ69G5FAV');
    mockDispatchEvent.mockResolvedValue({ pk: 'pk', sk: 'sk', version: 1 });
  });

  it('creates dispatch functions from a record', () => {
    const dispatch = createDispatch(
      {
        orderCreated: () => ({
          aggregateType: 'order',
          aggregateId: 'o-1',
          source: 'test',
          eventType: 'OrderCreated',
        }),
      },
      {},
    );

    expect(dispatch).toHaveProperty('orderCreated');
    expect(typeof dispatch.orderCreated).toBe('function');
  });

  it('passes args through to event builder', async () => {
    const builder = vi.fn((name: string, amount: number) => ({
      aggregateType: 'order',
      aggregateId: 'o-1',
      source: 'test',
      eventType: 'OrderCreated',
      payload: { name, amount },
    }));

    const dispatch = createDispatch({ create: builder }, {});

    await dispatch.create('test-order', 100);

    expect(builder).toHaveBeenCalledWith('test-order', 100);
  });

  it('calls dispatchEvent with assembled args', async () => {
    const dispatch = createDispatch(
      {
        orderCreated: () => ({
          aggregateType: 'order',
          aggregateId: 'o-1',
          source: 'test',
          eventType: 'OrderCreated',
        }),
      },
      {},
    );

    await dispatch.orderCreated();

    expect(mockDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'order',
        aggregateId: 'o-1',
        source: 'test',
        eventType: 'OrderCreated',
        eventId: 'evt-01ARZ3NDEKTSV4RRFFQ69G5FAV',
      }),
    );
  });

  it('merges event context into dispatch args', async () => {
    mockGetEventContext.mockReturnValue({
      correlationId: 'ctx-corr',
      actorId: 'ctx-actor',
    });

    const dispatch = createDispatch(
      {
        orderCreated: () => ({
          aggregateType: 'order',
          aggregateId: 'o-1',
          source: 'test',
          eventType: 'OrderCreated',
        }),
      },
      {},
    );

    await dispatch.orderCreated();

    expect(mockDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'ctx-corr',
        actorId: 'ctx-actor',
      }),
    );
  });

  it('merges options into dispatch args', async () => {
    const dispatch = createDispatch(
      {
        orderCreated: () => ({
          eventType: 'OrderCreated',
          aggregateId: 'o-1',
        }),
      },
      {
        aggregateType: 'order',
        source: 'order-service',
      },
    );

    await dispatch.orderCreated();

    expect(mockDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'order',
        source: 'order-service',
        eventType: 'OrderCreated',
        aggregateId: 'o-1',
      }),
    );
  });

  it('supports factory function as options', async () => {
    const dispatch = createDispatch(
      {
        orderCreated: () => ({
          eventType: 'OrderCreated',
          aggregateId: 'o-1',
        }),
      },
      (context) => ({
        aggregateType: 'order',
        source: 'order-service',
        correlationId: context.eventId,
      }),
    );

    await dispatch.orderCreated();

    expect(mockDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: 'order',
        source: 'order-service',
        correlationId: 'evt-01ARZ3NDEKTSV4RRFFQ69G5FAV',
      }),
    );
  });

  it('supports ValueOrFactory fields in the record return', async () => {
    const dispatch = createDispatch(
      {
        orderCreated: () => ({
          aggregateType: 'order',
          aggregateId: 'o-1',
          source: 'test',
          eventType: 'OrderCreated',
          correlationId: (ctx: { eventId: string }) => ctx.eventId,
        }),
      },
      {},
    );

    await dispatch.orderCreated();

    expect(mockDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'evt-01ARZ3NDEKTSV4RRFFQ69G5FAV',
      }),
    );
  });

  it('supports function-style return from builder (DispatchEventArgsFactory)', async () => {
    const dispatch = createDispatch(
      {
        orderCreated: () => (context: { eventId: string }) => ({
          aggregateType: 'order',
          aggregateId: 'o-1',
          source: 'test',
          eventType: 'OrderCreated',
          correlationId: context.eventId,
        }),
      },
      {},
    );

    await dispatch.orderCreated();

    expect(mockDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'evt-01ARZ3NDEKTSV4RRFFQ69G5FAV',
      }),
    );
  });

  it('returns the dispatchEvent result', async () => {
    const expected = { pk: 'AGG#order#o-1', sk: 'EVT#000000001', version: 1 };
    mockDispatchEvent.mockResolvedValue(expected);

    const dispatch = createDispatch(
      {
        orderCreated: () => ({
          aggregateType: 'order',
          aggregateId: 'o-1',
          source: 'test',
          eventType: 'OrderCreated',
        }),
      },
      {},
    );

    const result = await dispatch.orderCreated();
    expect(result).toEqual(expected);
  });
});
