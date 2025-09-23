import { isScopeSubject } from './is-scope-subject';
import { ScopeSubject } from './types';

describe('isScopeSubject', () => {
  describe('valid ScopeSubject objects', () => {
    it('should return true for a valid ScopeSubject with both type and id', () => {
      const subject: ScopeSubject = { type: 'org', id: '123' };
      expect(isScopeSubject(subject)).toBe(true);
    });

    it('should return true for a valid ScopeSubject with type only (id is optional)', () => {
      const subject: ScopeSubject = { type: 'org' };
      expect(isScopeSubject(subject)).toBe(true);
    });

    it('should return true for a valid ScopeSubject with empty string id', () => {
      const subject: ScopeSubject = { type: 'org', id: '' };
      expect(isScopeSubject(subject)).toBe(true);
    });

    it('should return true for a valid ScopeSubject with numeric string id', () => {
      const subject: ScopeSubject = { type: 'app', id: '456' };
      expect(isScopeSubject(subject)).toBe(true);
    });

    it('should return true for a valid ScopeSubject with alphanumeric id', () => {
      const subject: ScopeSubject = { type: 'user', id: 'user123' };
      expect(isScopeSubject(subject)).toBe(true);
    });

    it('should return true for a valid ScopeSubject with special characters in id', () => {
      const subject: ScopeSubject = { type: 'service', id: 'service-123_456' };
      expect(isScopeSubject(subject)).toBe(true);
    });

    it('should return true for a valid ScopeSubject with empty string type', () => {
      const subject: ScopeSubject = { type: '', id: '123' };
      expect(isScopeSubject(subject)).toBe(true);
    });

    it('should return true for a valid ScopeSubject with special characters in type', () => {
      const subject: ScopeSubject = { type: 'org-123', id: '456' };
      expect(isScopeSubject(subject)).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('should return false for null', () => {
      expect(isScopeSubject(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isScopeSubject(undefined)).toBe(false);
    });

    it('should return false for primitive types', () => {
      expect(isScopeSubject('string')).toBe(false);
      expect(isScopeSubject(123)).toBe(false);
      expect(isScopeSubject(true)).toBe(false);
      expect(isScopeSubject(false)).toBe(false);
      expect(isScopeSubject(0)).toBe(false);
      expect(isScopeSubject('')).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isScopeSubject([])).toBe(false);
      expect(isScopeSubject([1, 2, 3])).toBe(false);
      expect(isScopeSubject(['org', '123'])).toBe(false);
      expect(isScopeSubject([{ type: 'org', id: '123' }])).toBe(false);
    });

    it('should return false for functions', () => {
      expect(
        isScopeSubject(() => {
          // empty arrow function
        }),
      ).toBe(false);
      expect(
        isScopeSubject(function () {
          // empty function
        }),
      ).toBe(false);
    });

    it('should return false for Date objects', () => {
      expect(isScopeSubject(new Date())).toBe(false);
    });

    it('should return false for RegExp objects', () => {
      expect(isScopeSubject(/test/)).toBe(false);
    });
  });

  describe('objects missing required properties', () => {
    it('should return false for empty object', () => {
      expect(isScopeSubject({})).toBe(false);
    });

    it('should return false for object missing type property', () => {
      expect(isScopeSubject({ id: '123' })).toBe(false);
    });

    it('should return true for object missing id property (id is optional)', () => {
      expect(isScopeSubject({ type: 'org' })).toBe(true);
    });

    it('should return false for object with extra properties but missing required ones', () => {
      expect(isScopeSubject({ name: 'test', value: 123 })).toBe(false);
    });

    it('should return false for object with type property but wrong type', () => {
      expect(isScopeSubject({ type: 123, id: '123' })).toBe(false);
    });
  });

  describe('objects with wrong property types', () => {
    it('should return false when type is not a string', () => {
      expect(isScopeSubject({ type: 123, id: '123' })).toBe(false);
      expect(isScopeSubject({ type: true, id: '123' })).toBe(false);
      expect(isScopeSubject({ type: null, id: '123' })).toBe(false);
      expect(isScopeSubject({ type: undefined, id: '123' })).toBe(false);
      expect(isScopeSubject({ type: {}, id: '123' })).toBe(false);
      expect(isScopeSubject({ type: [], id: '123' })).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false for object with null properties', () => {
      expect(isScopeSubject({ type: null, id: null })).toBe(false);
    });

    it('should return false for object with undefined properties', () => {
      expect(isScopeSubject({ type: undefined, id: undefined })).toBe(false);
    });

    it('should return true for object with extra properties', () => {
      expect(isScopeSubject({ type: 'org', id: '123', extra: 'property' })).toBe(true);
    });

    it('should return true for object with nested objects', () => {
      expect(isScopeSubject({ type: 'org', id: '123', nested: { prop: 'value' } })).toBe(true);
    });

    it('should return true for object with array properties', () => {
      expect(isScopeSubject({ type: 'org', id: '123', array: [1, 2, 3] })).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should return true for typical org scope subject', () => {
      const subject: ScopeSubject = { type: 'org', id: '123' };
      expect(isScopeSubject(subject)).toBe(true);
    });

    it('should return true for typical app scope subject', () => {
      const subject: ScopeSubject = { type: 'app', id: '456' };
      expect(isScopeSubject(subject)).toBe(true);
    });

    it('should return true for typical user scope subject', () => {
      const subject: ScopeSubject = { type: 'user', id: '789' };
      expect(isScopeSubject(subject)).toBe(true);
    });

    it('should return true for typical service scope subject', () => {
      const subject: ScopeSubject = { type: 'service', id: '999' };
      expect(isScopeSubject(subject)).toBe(true);
    });

    it('should return true for scope subject with UUID id', () => {
      const subject: ScopeSubject = {
        type: 'user',
        id: '550e8400-e29b-41d4-a716-446655440000',
      };
      expect(isScopeSubject(subject)).toBe(true);
    });

    it('should return true for scope subject with complex id', () => {
      const subject: ScopeSubject = { type: 'app', id: 'app-123-prod-v2' };
      expect(isScopeSubject(subject)).toBe(true);
    });
  });

  describe('type guard behavior', () => {
    it('should narrow the type when used in conditional statements', () => {
      const unknownValue: unknown = { type: 'org', id: '123' };

      expect(isScopeSubject(unknownValue)).toBe(true);
      expect((unknownValue as { type: string }).type).toBe('org');
      expect((unknownValue as { id: string }).id).toBe('123');
    });

    it('should work in filter functions', () => {
      const mixedArray: unknown[] = [
        { type: 'org', id: '123' },
        'not a subject',
        { type: 'app', id: '456' },
        null,
        { type: 'user', id: '789' },
        { type: 123, id: '123' }, // wrong type for type property
        { type: 'user', id: 123 }, // wrong type for type property
      ];

      const subjects = mixedArray.filter(isScopeSubject);
      expect(subjects).toHaveLength(3);
      expect(subjects[0]).toStrictEqual({ type: 'org', id: '123' });
      expect(subjects[1]).toStrictEqual({ type: 'app', id: '456' });
      expect(subjects[2]).toStrictEqual({ type: 'user', id: '789' });
    });
  });
});
