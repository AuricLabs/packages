const { mockDispatchEvent } = vi.hoisted(() => ({
  mockDispatchEvent: vi.fn(),
}));

vi.mock('./dispatch-event', () => ({
  dispatchEvent: mockDispatchEvent,
}));

import { dispatchEvents } from './dispatch-events';

describe('dispatchEvents', () => {
  beforeEach(() => {
    mockDispatchEvent.mockReset();
    mockDispatchEvent.mockResolvedValue({ pk: 'pk', sk: 'sk', version: 1 });
  });

  it('dispatches events in parallel by default (Promise.all)', async () => {
    const events = [
      { aggregateType: 'order', aggregateId: '1', source: 'test', eventType: 'A' },
      { aggregateType: 'order', aggregateId: '2', source: 'test', eventType: 'B' },
      { aggregateType: 'order', aggregateId: '3', source: 'test', eventType: 'C' },
    ];

    await dispatchEvents(events);

    expect(mockDispatchEvent).toHaveBeenCalledTimes(3);
    expect(mockDispatchEvent).toHaveBeenCalledWith(events[0]);
    expect(mockDispatchEvent).toHaveBeenCalledWith(events[1]);
    expect(mockDispatchEvent).toHaveBeenCalledWith(events[2]);
  });

  it('dispatches events sequentially with inOrder: true', async () => {
    const callOrder: string[] = [];
    mockDispatchEvent.mockImplementation((event: { aggregateId: string }) => {
      callOrder.push(event.aggregateId);
      return Promise.resolve({ pk: 'pk', sk: 'sk', version: 1 });
    });

    const events = [
      { aggregateType: 'order', aggregateId: '1', source: 'test', eventType: 'A' },
      { aggregateType: 'order', aggregateId: '2', source: 'test', eventType: 'B' },
      { aggregateType: 'order', aggregateId: '3', source: 'test', eventType: 'C' },
    ];

    await dispatchEvents(events, { inOrder: true });

    expect(mockDispatchEvent).toHaveBeenCalledTimes(3);
    expect(callOrder).toEqual(['1', '2', '3']);
  });

  it('handles empty events array', async () => {
    await dispatchEvents([]);

    expect(mockDispatchEvent).not.toHaveBeenCalled();
  });

  it('handles empty events array with inOrder: true', async () => {
    await dispatchEvents([], { inOrder: true });

    expect(mockDispatchEvent).not.toHaveBeenCalled();
  });

  it('defaults inOrder to false when options not provided', async () => {
    const events = [{ aggregateType: 'order', aggregateId: '1', source: 'test', eventType: 'A' }];

    await dispatchEvents(events);

    expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
  });
});
