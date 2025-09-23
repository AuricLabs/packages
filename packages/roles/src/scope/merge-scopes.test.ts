import { mergeScopes } from './merge-scopes';
import { ScopeSubjectArray } from './types';

describe('mergeScopes', () => {
  describe('with undefined scopes', () => {
    it('should return empty array when no scopes provided', () => {
      const result = mergeScopes();
      expect(result).toStrictEqual([]);
    });

    it('should return empty array when all scopes are undefined', () => {
      const result = mergeScopes(undefined, undefined, undefined);
      expect(result).toStrictEqual([]);
    });

    it('should filter out undefined scopes', () => {
      const result = mergeScopes(undefined, 'org:123', undefined, 'app:456');
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ]);
    });
  });

  describe('with string scopes', () => {
    it('should parse single string scope', () => {
      const result = mergeScopes('org:123');
      expect(result).toStrictEqual([{ type: 'org', id: '123' }]);
    });

    it('should parse multiple string scopes', () => {
      const result = mergeScopes('org:123', 'app:456');
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ]);
    });

    it('should parse complex string scopes', () => {
      const result = mergeScopes('org:123:app:456:read');
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
        { type: 'read', id: undefined },
      ]);
    });

    it('should handle empty string scope', () => {
      const result = mergeScopes('');
      expect(result).toStrictEqual([]);
    });

    it('should handle system scope', () => {
      const result = mergeScopes('system');
      expect(result).toStrictEqual([{ type: 'system', id: undefined }]);
    });

    it('should normalize case to lowercase', () => {
      // @ts-expect-error test for uppercase
      const result = mergeScopes('ORG:123', 'APP:456');
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ]);
    });

    it('should trim whitespace', () => {
      // @ts-expect-error test for whitespace
      const result = mergeScopes(' org : 123 ', ' app : 456 ');
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ]);
    });
  });

  describe('with array string scopes', () => {
    it('should parse single array string scope', () => {
      const result = mergeScopes(['org', '123']);
      expect(result).toStrictEqual([{ type: 'org', id: '123' }]);
    });

    it('should parse multiple array string scopes', () => {
      const result = mergeScopes(['org', '123'], ['app', '456']);
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ]);
    });

    it('should parse complex array string scopes', () => {
      const result = mergeScopes(['org', '123', 'app', '456', 'read']);
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
        { type: 'read', id: undefined },
      ]);
    });

    it('should handle empty array scope', () => {
      const result = mergeScopes([]);
      expect(result).toStrictEqual([]);
    });

    it('should handle system array scope', () => {
      const result = mergeScopes(['system']);
      expect(result).toStrictEqual([{ type: 'system', id: undefined }]);
    });

    it('should normalize case to lowercase', () => {
      // @ts-expect-error test for uppercase
      const result = mergeScopes(['ORG', '123'], ['APP', '456']);
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ]);
    });

    it('should trim whitespace', () => {
      // @ts-expect-error test for whitespace
      const result = mergeScopes([' org ', ' 123 '], [' app ', ' 456 ']);
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ]);
    });
  });

  describe('with ScopeSubjectArray scopes', () => {
    it('should return ScopeSubjectArray as-is', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ];
      const result = mergeScopes(scopeSubjects);
      expect(result).toStrictEqual(scopeSubjects);
    });

    it('should merge multiple ScopeSubjectArray scopes', () => {
      const scope1: ScopeSubjectArray = [{ type: 'org', id: '123' }];
      const scope2: ScopeSubjectArray = [{ type: 'app', id: '456' }];
      const result = mergeScopes(scope1, scope2);
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ]);
    });

    it('should handle empty ScopeSubjectArray', () => {
      const result = mergeScopes([]);
      expect(result).toStrictEqual([]);
    });
  });

  describe('with mixed scope types', () => {
    it('should merge string and array string scopes', () => {
      const result = mergeScopes('org:123', ['app', '456']);
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ]);
    });

    it('should merge string and ScopeSubjectArray scopes', () => {
      const scopeSubjects: ScopeSubjectArray = [{ type: 'app', id: '456' }];
      const result = mergeScopes('org:123', scopeSubjects);
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ]);
    });

    it('should merge array string and ScopeSubjectArray scopes', () => {
      const scopeSubjects: ScopeSubjectArray = [{ type: 'app', id: '456' }];
      const result = mergeScopes(['org', '123'], scopeSubjects);
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ]);
    });

    it('should merge all three types together', () => {
      const scopeSubjects: ScopeSubjectArray = [{ type: 'service', id: '789' }];
      const result = mergeScopes('org:123', ['app', '456'], scopeSubjects);
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
        { type: 'service', id: '789' },
      ]);
    });
  });

  describe('edge cases', () => {
    it('should handle odd number of elements in array scope', () => {
      // @ts-expect-error test for mixed array types
      const result = mergeScopes(['org', '123', 'app']);
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: undefined },
      ]);
    });

    it('should handle single element in array scope', () => {
      const result = mergeScopes(['org']);
      expect(result).toStrictEqual([{ type: 'org', id: undefined }]);
    });

    it('should handle mixed undefined and valid scopes', () => {
      const result = mergeScopes(undefined, 'org:123', undefined, 'app:456', undefined);
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ]);
    });

    it('should preserve order of scopes', () => {
      // @ts-expect-error test for mixed array types
      const result = mergeScopes('org:123', 'app:456', 'service:789');
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
        { type: 'service', id: '789' },
      ]);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical OIDC scope merging', () => {
      const result = mergeScopes(
        // @ts-expect-error test for mixed array types
        'openid',
        'profile',
        'email',
        'org:123:read',
        'app:456:write',
      );
      expect(result).toStrictEqual([
        { type: 'openid', id: undefined },
        { type: 'profile', id: undefined },
        { type: 'email', id: undefined },
        { type: 'org', id: '123' },
        { type: 'read', id: undefined },
        { type: 'app', id: '456' },
        { type: 'write', id: undefined },
      ]);
    });

    it('should handle complex organizational scopes', () => {
      const result = mergeScopes(
        'org:123:app:456:read',
        'org:123:app:456:write',
        'org:123:user:789:read',
      );
      expect(result).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
        { type: 'read', id: undefined },
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
        { type: 'write', id: undefined },
        { type: 'org', id: '123' },
        { type: 'user', id: '789' },
        { type: 'read', id: undefined },
      ]);
    });
  });
});
