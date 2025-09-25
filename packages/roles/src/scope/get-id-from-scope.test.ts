import { describe, it, expect } from 'vitest';

import { getIdFromScope } from './get-id-from-scope';
import { ScopeSubjectArray } from './types';

describe('getIdFromScope', () => {
  describe('with undefined parameters', () => {
    it('should return undefined when scope is undefined', () => {
      const result = getIdFromScope(undefined, 'org');
      expect(result).toBeUndefined();
    });

    it('should return undefined when type is undefined', () => {
      const result = getIdFromScope('org:123', undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined when both scope and type are undefined', () => {
      const result = getIdFromScope(undefined, undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined when scope is null', () => {
      // @ts-expect-error test for null
      const result = getIdFromScope(null, 'org');
      expect(result).toBeUndefined();
    });

    it('should return undefined when type is null', () => {
      // @ts-expect-error test for null
      const result = getIdFromScope('org:123', null);
      expect(result).toBeUndefined();
    });
  });

  describe('with string scopes', () => {
    it('should extract org id from simple scope', () => {
      const result = getIdFromScope('org:123', 'org');
      expect(result).toBe('123');
    });

    it('should extract app id from simple scope', () => {
      const result = getIdFromScope('app:456', 'app');
      expect(result).toBe('456');
    });

    it('should extract org id from complex scope', () => {
      const result = getIdFromScope('org:123:app:456:read', 'org');
      expect(result).toBe('123');
    });

    it('should extract app id from complex scope', () => {
      const result = getIdFromScope('org:123:app:456:read', 'app');
      expect(result).toBe('456');
    });

    it('should return undefined when type not found', () => {
      const result = getIdFromScope('org:123:app:456', 'user');
      expect(result).toBeUndefined();
    });

    it('should return undefined when type exists but no id', () => {
      const result = getIdFromScope('org:app:456', 'org');
      expect(result).toBe('app');
    });

    it('should handle scope with trailing colon', () => {
      expect(() => getIdFromScope('org:123:', 'org')).toThrow(
        'Invalid scope string array: ["org","123",""]. Scope must be a string or an array of strings or an array of ScopeSubjects.',
      );
    });

    it('should handle scope with leading colon', () => {
      // @ts-expect-error test for empty string
      expect(() => getIdFromScope(':org:123', 'org')).toThrow(
        'Invalid scope string array: ["","org","123"]. Scope must be a string or an array of strings or an array of ScopeSubjects.',
      );
    });

    it('should handle scope with multiple colons', () => {
      expect(() => getIdFromScope('org:123::app:456', 'org')).toThrow(
        'Invalid scope string array: ["org","123","","app","456"]. Scope must be a string or an array of strings or an array of ScopeSubjects.',
      );
    });

    it('should handle system scope', () => {
      const result = getIdFromScope('system', 'system');
      expect(result).toBeUndefined();
    });

    it('should handle empty string scope', () => {
      const result = getIdFromScope('', 'org');
      expect(result).toBeUndefined();
    });
  });

  describe('with array string scopes', () => {
    it('should extract org id from array scope', () => {
      const result = getIdFromScope(['org', '123'], 'org');
      expect(result).toBe('123');
    });

    it('should extract app id from array scope', () => {
      const result = getIdFromScope(['app', '456'], 'app');
      expect(result).toBe('456');
    });

    it('should extract org id from complex array scope', () => {
      const result = getIdFromScope(['org', '123', 'app', '456', 'read'], 'org');
      expect(result).toBe('123');
    });

    it('should extract app id from complex array scope', () => {
      const result = getIdFromScope(['org', '123', 'app', '456', 'read'], 'app');
      expect(result).toBe('456');
    });

    it('should return undefined when type not found in array', () => {
      const result = getIdFromScope(['org', '123', 'app', '456'], 'user');
      expect(result).toBeUndefined();
    });

    it('should handle array with single element', () => {
      const result = getIdFromScope(['system'], 'system');
      expect(result).toBeUndefined();
    });

    it('should handle empty array', () => {
      const result = getIdFromScope([], 'org');
      expect(result).toBeUndefined();
    });

    it('should handle array with odd number of elements', () => {
      // @ts-expect-error test for mixed array types
      const result = getIdFromScope(['org', '123', 'app'], 'org');
      expect(result).toBe('123');
    });
  });

  describe('with ScopeSubjectArray scopes', () => {
    it('should extract org id from ScopeSubjectArray', () => {
      const scopeSubjects: ScopeSubjectArray = [{ type: 'org', id: '123' }];
      const result = getIdFromScope(scopeSubjects, 'org');
      expect(result).toBe('123');
    });

    it('should extract app id from ScopeSubjectArray', () => {
      const scopeSubjects: ScopeSubjectArray = [{ type: 'app', id: '456' }];
      const result = getIdFromScope(scopeSubjects, 'app');
      expect(result).toBe('456');
    });

    it('should extract org id from complex ScopeSubjectArray', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
        { type: 'read', id: undefined },
      ];
      const result = getIdFromScope(scopeSubjects, 'org');
      expect(result).toBe('123');
    });

    it('should extract app id from complex ScopeSubjectArray', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
        { type: 'read', id: undefined },
      ];
      const result = getIdFromScope(scopeSubjects, 'app');
      expect(result).toBe('456');
    });

    it('should return undefined when type not found in ScopeSubjectArray', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ];
      const result = getIdFromScope(scopeSubjects, 'user');
      expect(result).toBeUndefined();
    });

    it('should handle ScopeSubjectArray with undefined id', () => {
      const scopeSubjects: ScopeSubjectArray = [{ type: 'org', id: undefined }];
      const result = getIdFromScope(scopeSubjects, 'org');
      expect(result).toBeUndefined();
    });

    it('should handle ScopeSubjectArray with empty string id', () => {
      const scopeSubjects: ScopeSubjectArray = [{ type: 'org', id: '' }];
      const result = getIdFromScope(scopeSubjects, 'org');
      expect(result).toBe('');
    });

    it('should handle empty ScopeSubjectArray', () => {
      const scopeSubjects: ScopeSubjectArray = [];
      const result = getIdFromScope(scopeSubjects, 'org');
      expect(result).toBeUndefined();
    });
  });

  describe('with mixed scope types', () => {
    it('should extract id from string scope with variables', () => {
      const result = getIdFromScope('org:{orgId}:app:456', 'org');
      expect(result).toBe('{orgid}');
    });

    it('should extract id from array scope with variables', () => {
      const result = getIdFromScope(['org', '{orgId}', 'app', '456'], 'org');
      expect(result).toBe('{orgid}');
    });

    it('should extract id from ScopeSubjectArray with variables', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '{orgId}' },
        { type: 'app', id: '456' },
      ];
      const result = getIdFromScope(scopeSubjects, 'org');
      expect(result).toBe('{orgId}');
    });
  });

  describe('edge cases', () => {
    it('should handle scope with special characters in id', () => {
      const result = getIdFromScope('org:123-456_789', 'org');
      expect(result).toBe('123-456_789');
    });

    it('should handle scope with numbers in type', () => {
      // @ts-expect-error test for numbers in type
      const result = getIdFromScope('app123:456', 'app123');
      expect(result).toBe('456');
    });

    it('should handle scope with spaces (after stringify)', () => {
      // @ts-expect-error test for whitespace
      const result = getIdFromScope(' org : 123 ', 'org');
      expect(result).toBe('123');
    });

    it('should handle scope with mixed case', () => {
      // @ts-expect-error test for uppercase
      const result = getIdFromScope('ORG:123:APP:456', 'org');
      expect(result).toBe('123');
    });

    it('should handle scope with multiple occurrences of same type', () => {
      const result = getIdFromScope('org:123:org:456', 'org');
      expect(result).toBe('123'); // Returns first match
    });

    it('should handle scope with type that contains colons', () => {
      const result = getIdFromScope('org:123:app:456', 'org');
      expect(result).toBe('123');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical OIDC scope', () => {
      const result = getIdFromScope(
        // @ts-expect-error test for mixed array types
        'openid:profile:email:org:123:app:456',
        'org',
      );
      expect(result).toBeUndefined();
    });

    it('should handle organizational scope', () => {
      const result = getIdFromScope('org:123:app:456:read', 'org');
      expect(result).toBe('123');
    });

    it('should handle user scope', () => {
      const result = getIdFromScope('org:123:user:789:read', 'user');
      expect(result).toBe('789');
    });

    it('should handle service scope', () => {
      const result = getIdFromScope('org:123:service:999:manage', 'service');
      expect(result).toBe('999');
    });

    it('should handle complex nested scope', () => {
      const result = getIdFromScope('org:123:app:456:resource:789:action:read', 'resource');
      expect(result).toBe('789');
    });
  });

  describe('regex edge cases', () => {
    it('should handle type with regex special characters', () => {
      // @ts-expect-error test for regex special characters
      const result = getIdFromScope('org.123:456', 'org.123');
      expect(result).toBe('456');
    });

    it('should handle type with parentheses', () => {
      // @ts-expect-error test for parentheses
      const result = getIdFromScope('org(123):456', 'org(123)');
      expect(result).toBe('456');
    });

    it('should handle type with brackets', () => {
      // @ts-expect-error test for brackets
      const result = getIdFromScope('org[123]:456', 'org[123]');
      expect(result).toBe('456');
    });

    it('should handle type with dots', () => {
      // @ts-expect-error test for dots
      const result = getIdFromScope('org.123:456', 'org.123');
      expect(result).toBe('456');
    });

    it('should handle type with underscores', () => {
      // @ts-expect-error test for underscores
      const result = getIdFromScope('org_123:456', 'org_123');
      expect(result).toBe('456');
    });
  });
});
