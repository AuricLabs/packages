const { mockCreateEventService } = vi.hoisted(() => ({
  mockCreateEventService: vi.fn(),
}));

vi.mock('./event-service', () => ({
  createEventService: mockCreateEventService,
}));

import { initEvents, getEventService } from './init';

describe('init', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateEventService.mockReset();
  });

  describe('getEventService', () => {
    it('throws before initEvents is called', () => {
      // Re-import to get fresh module state
      // Since the module state persists, we need to test the throw case first
      // Actually with vi.mock the module is already imported. We need to use dynamic import.
    });
  });

  describe('initEvents', () => {
    it('calls createEventService with tableName', () => {
      const fakeService = { appendEvent: vi.fn() };
      mockCreateEventService.mockReturnValue(fakeService);

      initEvents({ tableName: 'my-events-table' });

      expect(mockCreateEventService).toHaveBeenCalledWith('my-events-table');
    });

    it('allows getEventService to return the created service', () => {
      const fakeService = { appendEvent: vi.fn(), getHead: vi.fn() };
      mockCreateEventService.mockReturnValue(fakeService);

      initEvents({ tableName: 'test-table' });
      const result = getEventService();

      expect(result).toBe(fakeService);
    });
  });
});

describe('init (fresh module)', () => {
  it('getEventService throws before initEvents is called', async () => {
    vi.resetModules();

    const { getEventService: freshGetEventService } = await import('./init');

    expect(() => freshGetEventService()).toThrow('Call initEvents() before using events');
  });
});
