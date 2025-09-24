import { describe, it, expect } from '@jest/globals';

import { isScope } from './is-scope';
import { Scope, ScopeSubject } from './types';

describe('isScope', () => {
  describe('valid string scopes', () => {
    it('should return true for empty string scope', () => {
      expect(isScope('')).toBe(true);
    });

    it('should return true for system scope', () => {
      expect(isScope('system')).toBe(true);
    });

    it('should return true for org scope', () => {
      expect(isScope('org')).toBe(true);
    });

    it('should return true for org scope with ID', () => {
      expect(isScope('org:123')).toBe(true);
    });

    it('should return true for app scope', () => {
      expect(isScope('app:myapp')).toBe(true);
    });

    it('should return true for app scope with additional segments', () => {
      expect(isScope('app:myapp:feature')).toBe(true);
    });

    it('should return true for app scope with multiple segments', () => {
      expect(isScope('app:myapp:feature:subfeature')).toBe(true);
    });

    it('should return true for org with app scope', () => {
      expect(isScope('org:123:app:myapp')).toBe(true);
    });

    it('should return true for complex scope strings', () => {
      expect(isScope('org:org123:app:myapp:feature:subfeature')).toBe(true);
    });
  });

  describe('valid array scopes - string arrays', () => {
    it('should return true for empty array scope', () => {
      expect(isScope([])).toBe(true);
    });

    it('should return true for system scope array', () => {
      expect(isScope(['system'])).toBe(true);
    });

    it('should return true for org scope array', () => {
      expect(isScope(['org'])).toBe(true);
    });

    it('should return true for org scope array with ID', () => {
      expect(isScope(['org', '123'])).toBe(true);
    });

    it('should return true for app scope array', () => {
      expect(isScope(['app', 'myapp'])).toBe(true);
    });

    it('should return true for app scope array with additional segments', () => {
      expect(isScope(['app', 'myapp', 'feature'])).toBe(true);
    });

    it('should return true for app scope array with multiple segments', () => {
      expect(isScope(['app', 'myapp', 'feature', 'subfeature'])).toBe(true);
    });

    it('should return true for org with app scope array', () => {
      expect(isScope(['org', '123', 'app', 'myapp'])).toBe(true);
    });

    it('should return true for complex scope arrays', () => {
      expect(isScope(['org', 'org123', 'app', 'myapp', 'feature', 'subfeature'])).toBe(true);
    });
  });

  describe('valid array scopes - subject arrays', () => {
    it('should return true for single scope subject array', () => {
      const scopeSubject: ScopeSubject[] = [{ type: 'org', id: '123' }];
      expect(isScope(scopeSubject)).toBe(true);
    });

    it('should return true for scope subject without ID', () => {
      const scopeSubject: ScopeSubject[] = [{ type: 'org' }];
      expect(isScope(scopeSubject)).toBe(true);
    });

    it('should return true for multiple scope subjects', () => {
      const scopeSubject: ScopeSubject[] = [
        { type: 'org', id: '123' },
        { type: 'app', id: 'myapp' },
      ];
      expect(isScope(scopeSubject)).toBe(true);
    });

    it('should return true for app scope subject', () => {
      const scopeSubject: ScopeSubject[] = [{ type: 'app', id: 'myapp' }];
      expect(isScope(scopeSubject)).toBe(true);
    });

    it('should return true for user scope subject', () => {
      const scopeSubject: ScopeSubject[] = [{ type: 'user', id: '789' }];
      expect(isScope(scopeSubject)).toBe(true);
    });

    it('should return true for service scope subject', () => {
      const scopeSubject: ScopeSubject[] = [{ type: 'service', id: '999' }];
      expect(isScope(scopeSubject)).toBe(true);
    });

    it('should return true for scope subject with UUID ID', () => {
      const scopeSubject: ScopeSubject[] = [
        { type: 'user', id: '550e8400-e29b-41d4-a716-446655440000' },
      ];
      expect(isScope(scopeSubject)).toBe(true);
    });

    it('should return true for scope subject with complex ID', () => {
      const scopeSubject: ScopeSubject[] = [{ type: 'app', id: 'app-123-prod-v2' }];
      expect(isScope(scopeSubject)).toBe(true);
    });
  });

  describe('invalid inputs - primitives', () => {
    it('should return false for null', () => {
      expect(isScope(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isScope(undefined)).toBe(false);
    });

    it('should return false for number', () => {
      expect(isScope(123)).toBe(false);
    });

    it('should return false for zero', () => {
      expect(isScope(0)).toBe(false);
    });

    it('should return false for boolean true', () => {
      expect(isScope(true)).toBe(false);
    });

    it('should return false for boolean false', () => {
      expect(isScope(false)).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(isScope(NaN)).toBe(false);
    });

    it('should return false for Infinity', () => {
      expect(isScope(Infinity)).toBe(false);
    });

    it('should return false for negative Infinity', () => {
      expect(isScope(-Infinity)).toBe(false);
    });
  });

  describe('invalid inputs - objects', () => {
    it('should return false for plain object', () => {
      expect(isScope({})).toBe(false);
    });

    it('should return false for object with properties', () => {
      expect(isScope({ type: 'org', id: '123' })).toBe(false);
    });

    it('should return false for Date object', () => {
      expect(isScope(new Date())).toBe(false);
    });

    it('should return false for RegExp object', () => {
      expect(isScope(/test/)).toBe(false);
    });

    it('should return false for Error object', () => {
      expect(isScope(new Error('test'))).toBe(false);
    });

    it('should return false for Map object', () => {
      expect(isScope(new Map())).toBe(false);
    });

    it('should return false for Set object', () => {
      expect(isScope(new Set())).toBe(false);
    });

    it('should return false for WeakMap object', () => {
      expect(isScope(new WeakMap())).toBe(false);
    });

    it('should return false for WeakSet object', () => {
      expect(isScope(new WeakSet())).toBe(false);
    });
  });

  describe('invalid inputs - functions', () => {
    it('should return false for arrow function', () => {
      expect(
        isScope(() => {
          // empty arrow function
        }),
      ).toBe(false);
    });

    it('should return false for regular function', () => {
      expect(
        isScope(function () {
          // empty function
        }),
      ).toBe(false);
    });

    it('should return false for named function', () => {
      function testFunction() {
        // empty function
      }
      expect(isScope(testFunction)).toBe(false);
    });

    it('should return false for async function', () => {
      expect(
        isScope((async () => {
          // empty async function
        }) as unknown),
      ).toBe(false);
    });

    it('should return false for generator function', () => {
      expect(
        isScope(function* () {
          // empty generator function
        }),
      ).toBe(false);
    });
  });

  describe('invalid inputs - symbols', () => {
    it('should return false for symbol', () => {
      expect(isScope(Symbol('test'))).toBe(false);
    });

    it('should return false for Symbol.iterator', () => {
      expect(isScope(Symbol.iterator)).toBe(false);
    });

    it('should return false for Symbol.for', () => {
      expect(isScope(Symbol.for('test'))).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return true for very long scope string', () => {
      const longScope = 'app:' + 'a'.repeat(1000);
      expect(isScope(longScope)).toBe(true);
    });

    it('should return true for very long scope array', () => {
      const longArray = ['app'].concat(Array(1000).fill('segment'));
      expect(isScope(longArray)).toBe(true);
    });

    it('should return true for array with special character strings', () => {
      expect(isScope(['org', 'special-chars_123!@#$%^&*()'])).toBe(true);
    });

    it('should return true for string with special characters', () => {
      expect(isScope('org:special-chars_123!@#$%^&*()')).toBe(true);
    });

    it('should return true for array with empty strings', () => {
      expect(isScope(['', ''])).toBe(true);
    });

    it('should return true for array with mixed content types that are strings', () => {
      expect(isScope(['org', '123', 'app', 'myapp', ''])).toBe(true);
    });

    it('should return true for frozen array', () => {
      const frozenArray = Object.freeze(['org', '123']);
      expect(isScope(frozenArray)).toBe(true);
    });

    it('should return true for readonly array', () => {
      const readonlyArray: readonly string[] = ['org', '123'];
      expect(isScope(readonlyArray)).toBe(true);
    });
  });

  describe('type guard behavior', () => {
    it('should narrow the type when used in conditional statements', () => {
      const unknownValue: unknown = 'org:123';
      expect(isScope(unknownValue)).toBe(true);
    });

    it('should work with string scope in type guard', () => {
      const unknownValue: unknown = 'system';
      expect(isScope(unknownValue)).toBe(true);
    });

    it('should work with array scope in type guard', () => {
      const unknownValue: unknown = ['org', '123'];

      expect(isScope(unknownValue)).toBe(true);
      expect(Array.isArray(unknownValue)).toBe(true);
      expect(unknownValue).toStrictEqual(['org', '123']);
    });

    it('should work with scope subject array in type guard', () => {
      const unknownValue: unknown = [{ type: 'org', id: '123' }];

      expect(isScope(unknownValue)).toBe(true);
      expect(Array.isArray(unknownValue)).toBe(true);
      expect(unknownValue).toStrictEqual([{ type: 'org', id: '123' }]);
    });

    it('should work in filter functions', () => {
      const mixedArray: unknown[] = [
        'org:123',
        ['app', 'myapp'],
        [{ type: 'user', id: '789' }],
        123,
        null,
        undefined,
        {},
        true,
        'system',
      ];

      const scopes = mixedArray.filter(isScope);
      expect(scopes).toHaveLength(4);
      expect(scopes[0]).toBe('org:123');
      expect(scopes[1]).toStrictEqual(['app', 'myapp']);
      expect(scopes[2]).toStrictEqual([{ type: 'user', id: '789' }]);
      expect(scopes[3]).toBe('system');
    });
  });

  describe('real-world scenarios', () => {
    it('should return true for typical global scope', () => {
      expect(isScope('')).toBe(true);
    });

    it('should return true for typical system scope', () => {
      expect(isScope('system')).toBe(true);
    });

    it('should return true for typical org scope string', () => {
      expect(isScope('org:company-123')).toBe(true);
    });

    it('should return true for typical org scope array', () => {
      expect(isScope(['org', 'company-123'])).toBe(true);
    });

    it('should return true for typical app scope string', () => {
      expect(isScope('app:my-application')).toBe(true);
    });

    it('should return true for typical app scope array', () => {
      expect(isScope(['app', 'my-application'])).toBe(true);
    });

    it('should return true for complex org-app scope string', () => {
      expect(isScope('org:company-123:app:my-application')).toBe(true);
    });

    it('should return true for complex org-app scope array', () => {
      expect(isScope(['org', 'company-123', 'app', 'my-application'])).toBe(true);
    });

    it('should return true for scope subject representing org', () => {
      const orgScope: Scope = [{ type: 'org', id: 'company-123' }];
      expect(isScope(orgScope)).toBe(true);
    });

    it('should return true for scope subject representing app', () => {
      const appScope: Scope = [{ type: 'app', id: 'my-application' }];
      expect(isScope(appScope)).toBe(true);
    });

    it('should return true for multi-level scope subjects', () => {
      const multiScope: Scope = [
        { type: 'org', id: 'company-123' },
        { type: 'app', id: 'my-application' },
        { type: 'feature', id: 'user-management' },
      ];
      expect(isScope(multiScope)).toBe(true);
    });
  });

  describe('type safety', () => {
    it('should accept all valid Scope types', () => {
      // These should compile without TypeScript errors
      const stringScope: Scope = 'org:123';
      const arrayScope: Scope = ['org', '123'];
      const subjectScope: Scope = [{ type: 'org', id: '123' }];
      const emptyScope: Scope = '';
      const systemScope: Scope = 'system';
      const emptyArrayScope: Scope = [];

      expect(typeof isScope(stringScope)).toBe('boolean');
      expect(typeof isScope(arrayScope)).toBe('boolean');
      expect(typeof isScope(subjectScope)).toBe('boolean');
      expect(typeof isScope(emptyScope)).toBe('boolean');
      expect(typeof isScope(systemScope)).toBe('boolean');
      expect(typeof isScope(emptyArrayScope)).toBe('boolean');
    });

    it('should return true for all valid Scope instances', () => {
      const stringScope: Scope = 'org:123';
      const arrayScope: Scope = ['org', '123'];
      const subjectScope: Scope = [{ type: 'org', id: '123' }];
      const emptyScope: Scope = '';
      const systemScope: Scope = 'system';
      const emptyArrayScope: Scope = [];

      expect(isScope(stringScope)).toBe(true);
      expect(isScope(arrayScope)).toBe(true);
      expect(isScope(subjectScope)).toBe(true);
      expect(isScope(emptyScope)).toBe(true);
      expect(isScope(systemScope)).toBe(true);
      expect(isScope(emptyArrayScope)).toBe(true);
    });
  });
});
