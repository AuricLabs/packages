import { setEventContext, getEventContext, resetEventContext, appendEventContext } from './context';

describe('context', () => {
  afterEach(() => {
    resetEventContext();
  });

  describe('getEventContext', () => {
    it('returns empty object by default', () => {
      expect(getEventContext()).toEqual({});
    });
  });

  describe('setEventContext', () => {
    it('sets the context', () => {
      setEventContext({ aggregateType: 'order', aggregateId: '123' });
      expect(getEventContext()).toEqual({ aggregateType: 'order', aggregateId: '123' });
    });

    it('replaces the entire context', () => {
      setEventContext({ aggregateType: 'order' });
      setEventContext({ aggregateId: '456' });
      expect(getEventContext()).toEqual({ aggregateId: '456' });
    });

    it('creates a shallow copy (does not hold reference to input)', () => {
      const input = { aggregateType: 'order' };
      setEventContext(input);
      input.aggregateType = 'changed';
      expect(getEventContext()).toEqual({ aggregateType: 'order' });
    });
  });

  describe('resetEventContext', () => {
    it('resets to empty object', () => {
      setEventContext({ aggregateType: 'order', aggregateId: '123' });
      resetEventContext();
      expect(getEventContext()).toEqual({});
    });
  });

  describe('appendEventContext', () => {
    it('merges into existing context', () => {
      setEventContext({ aggregateType: 'order' });
      appendEventContext({ aggregateId: '123' });
      expect(getEventContext()).toEqual({ aggregateType: 'order', aggregateId: '123' });
    });

    it('overwrites existing keys', () => {
      setEventContext({ aggregateType: 'order', aggregateId: '111' });
      appendEventContext({ aggregateId: '222' });
      expect(getEventContext()).toEqual({ aggregateType: 'order', aggregateId: '222' });
    });

    it('works on empty context', () => {
      appendEventContext({ source: 'test-source' });
      expect(getEventContext()).toEqual({ source: 'test-source' });
    });
  });
});
