import { createScopeRegex } from './create-scope-regex';
import { ScopeSubjectArray } from './types';

describe('createScopeRegex', () => {
  describe('with string scopes', () => {
    it('should create regex for simple string scope', () => {
      const regex = createScopeRegex('org:123');
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.source).toBe('^org:123');
    });

    it('should create regex for empty string scope', () => {
      const regex = createScopeRegex('');
      expect(regex.source).toBe('^');
    });

    it('should create regex for system scope', () => {
      const regex = createScopeRegex('system');
      expect(regex.source).toBe('^system');
    });

    it('should create regex for complex string scope', () => {
      const regex = createScopeRegex('org:123:app:456:read');
      expect(regex.source).toBe('^org:123:app:456:read');
    });

    it('should handle string scope with wildcards', () => {
      const regex = createScopeRegex('org:*:app:*');
      expect(regex.source).toBe('^org:[^:]*:app:[^:]*');
    });

    it('should handle string scope with multiple wildcards', () => {
      const regex = createScopeRegex('org:*:app:*:*');
      expect(regex.source).toBe('^org:[^:]*:app:[^:]*:[^:]*');
    });

    it('should handle string scope starting with wildcard', () => {
      // @ts-expect-error test for wildcard
      const regex = createScopeRegex('*:123:app:456');
      expect(regex.source).toBe('^[^:]*:123:app:456');
    });

    it('should handle string scope ending with wildcard', () => {
      const regex = createScopeRegex('org:123:app:*');
      expect(regex.source).toBe('^org:123:app:[^:]*');
    });

    it('should handle string scope with only wildcards', () => {
      // @ts-expect-error test for wildcard
      const regex = createScopeRegex('*:*:*');
      expect(regex.source).toBe('^[^:]*:[^:]*:[^:]*');
    });
  });

  describe('with array scopes', () => {
    it('should create regex for simple array scope', () => {
      const regex = createScopeRegex(['org', '123']);
      expect(regex.source).toBe('^org:123');
    });

    it('should create regex for empty array scope', () => {
      const regex = createScopeRegex([]);
      expect(regex.source).toBe('^');
    });

    it('should create regex for single element array scope', () => {
      const regex = createScopeRegex(['system']);
      expect(regex.source).toBe('^system');
    });

    it('should create regex for complex array scope', () => {
      const regex = createScopeRegex(['org', '123', 'app', '456', 'read']);
      expect(regex.source).toBe('^org:123:app:456:read');
    });

    it('should handle array scope with wildcards', () => {
      const regex = createScopeRegex(['org', '*', 'app', '*']);
      expect(regex.source).toBe('^org:[^:]*:app:[^:]*');
    });

    it('should handle array scope with mixed wildcards and values', () => {
      const regex = createScopeRegex(['org', '123', 'app', '*', 'read']);
      expect(regex.source).toBe('^org:123:app:[^:]*:read');
    });
  });

  describe('with ScopeSubjectArray scopes', () => {
    it('should create regex for simple ScopeSubjectArray', () => {
      const scopeSubjects: ScopeSubjectArray = [{ type: 'org', id: '123' }];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^org:123');
    });

    it('should create regex for ScopeSubjectArray with multiple subjects', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^org:123:app:456');
    });

    it('should create regex for ScopeSubjectArray with undefined id', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: 'app', id: undefined },
      ];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^org:123:app');
    });

    it('should create regex for ScopeSubjectArray with system scope', () => {
      const scopeSubjects: ScopeSubjectArray = [{ type: 'system', id: undefined }];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^system');
    });

    it('should create regex for empty ScopeSubjectArray', () => {
      const scopeSubjects: ScopeSubjectArray = [];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^');
    });

    it('should handle ScopeSubjectArray with wildcards in id', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '*' },
        { type: 'app', id: '456' },
      ];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^org:[^:]*:app:456');
    });

    it('should handle ScopeSubjectArray with wildcards in type', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: '*', id: '123' },
        { type: 'app', id: '456' },
      ];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^[^:]*:123:app:456');
    });
  });

  describe('regex matching behavior', () => {
    it('should match exact scope strings', () => {
      const regex = createScopeRegex('org:123:app:456');
      expect(regex.test('org:123:app:456')).toBe(true);
      expect(regex.test('org:123:app:456:read')).toBe(true); // Should match prefix
      expect(regex.test('org:123:app:789')).toBe(false);
      expect(regex.test('system')).toBe(false);
    });

    it('should match wildcard patterns correctly', () => {
      const regex = createScopeRegex('org:*:app:456');
      expect(regex.test('org:123:app:456')).toBe(true);
      expect(regex.test('org:abc:app:456')).toBe(true);
      expect(regex.test('org:123:app:456:read')).toBe(true); // Should match prefix
      expect(regex.test('org::app:456')).toBe(true); // Empty string matches [^:]*
      expect(regex.test('org:123:service:456')).toBe(false);
      expect(regex.test('system')).toBe(false);
    });

    it('should match multiple wildcards correctly', () => {
      const regex = createScopeRegex('org:*:app:*');
      expect(regex.test('org:123:app:456')).toBe(true);
      expect(regex.test('org:abc:app:xyz')).toBe(true);
      expect(regex.test('org::app:')).toBe(true);
      expect(regex.test('org:123:service:456')).toBe(false);
    });

    it('should handle wildcard at start', () => {
      // @ts-expect-error test for wildcard
      const regex = createScopeRegex('*:123:app:456');
      expect(regex.test('org:123:app:456')).toBe(true);
      expect(regex.test('system:123:app:456')).toBe(true);
      expect(regex.test(':123:app:456')).toBe(true);
      expect(regex.test('org:456:app:456')).toBe(false);
    });

    it('should handle wildcard at end', () => {
      const regex = createScopeRegex('org:123:app:*');
      expect(regex.test('org:123:app:456')).toBe(true);
      expect(regex.test('org:123:app:')).toBe(true);
      expect(regex.test('org:123:app:xyz')).toBe(true);
      expect(regex.test('org:123:service:456')).toBe(false);
    });

    it('should handle only wildcards', () => {
      // @ts-expect-error test for wildcard
      const regex = createScopeRegex('*:*:*');
      expect(regex.test('org:123:app')).toBe(true);
      expect(regex.test('system:456:read')).toBe(true);
      expect(regex.test(':::')).toBe(true); // Should not match colons
      expect(regex.test('one:two')).toBe(false); // Should not match fewer segments
    });

    it('should handle system scope', () => {
      const regex = createScopeRegex('system');
      expect(regex.test('system')).toBe(true);
      expect(regex.test('system:read')).toBe(true); // Should match prefix
      expect(regex.test('org:system')).toBe(false);
    });

    it('should handle empty scope', () => {
      const regex = createScopeRegex('');
      expect(regex.test('')).toBe(true);
      expect(regex.test('org:123')).toBe(true); // Should match any string (empty prefix)
      expect(regex.test('system')).toBe(true);
    });

    it('should be case-sensitive as input (stringifyScope handles case)', () => {
      // @ts-expect-error test for uppercase
      const regex = createScopeRegex('ORG:123');
      expect(regex.test('ORG:123')).toBe(false);
      expect(regex.test('org:123')).toBe(true);
    });

    it('should not match across colon boundaries with wildcards', () => {
      const regex = createScopeRegex('org:*:app');
      expect(regex.test('org:123:app')).toBe(true);
      expect(regex.test('org:123:456:app')).toBe(false); // * should not match across colons
      expect(regex.test('org::app')).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical OIDC scope pattern matching', () => {
      const regex = createScopeRegex('org:*:app:*:read');
      expect(regex.test('org:123:app:456:read')).toBe(true);
      expect(regex.test('org:abc:app:xyz:read')).toBe(true);
      expect(regex.test('org:123:app:456:read:files')).toBe(true); // Should match prefix
      expect(regex.test('org:123:app:456:write')).toBe(false);
    });

    it('should handle organizational scope patterns', () => {
      const regex = createScopeRegex('org:*');
      expect(regex.test('org:123')).toBe(true);
      expect(regex.test('org:456')).toBe(true);
      expect(regex.test('org:123:app:456')).toBe(true); // Should match prefix
      expect(regex.test('app:123')).toBe(false);
    });

    it('should handle application scope patterns', () => {
      const regex = createScopeRegex('app:*:*');
      expect(regex.test('app:123:read')).toBe(true);
      expect(regex.test('app:456:write')).toBe(true);
      expect(regex.test('app:123:admin:users')).toBe(true); // Should match prefix
      expect(regex.test('org:123:read')).toBe(false);
    });

    it('should handle permission checking patterns', () => {
      // @ts-expect-error test for wildcard
      const regex = createScopeRegex('*:*:*:manage');
      expect(regex.test('org:123:app:manage')).toBe(true);
      expect(regex.test('org:456:user:manage')).toBe(true);
      expect(regex.test('system:admin:role:manage')).toBe(true);
      expect(regex.test('org:123:app:read')).toBe(false);
    });

    it('should handle complex nested scope patterns', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '*' },
        { type: 'app', id: '456' },
        { type: 'resource', id: '*' },
        { type: 'read', id: undefined },
      ];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.test('org:123:app:456:resource:789:read')).toBe(true);
      expect(regex.test('org:abc:app:456:resource:xyz:read')).toBe(true);
      expect(regex.test('org:123:app:789:resource:xyz:read')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle special regex characters in scope values', () => {
      const regex = createScopeRegex('org:test.123:app:test[456]');
      expect(regex.test('org:test.123:app:test[456]')).toBe(true);
      expect(regex.test('org:testX123:app:testY456Z')).toBe(false);
    });

    it('should handle scope with numbers', () => {
      const regex = createScopeRegex('org:123:app:456');
      expect(regex.test('org:123:app:456')).toBe(true);
      expect(regex.test('org:123:app:789')).toBe(false);
    });

    it('should handle scope with hyphens and underscores', () => {
      const regex = createScopeRegex('org:test-org_123:app:test-app_456');
      expect(regex.test('org:test-org_123:app:test-app_456')).toBe(true);
      expect(regex.test('org:test-org_456:app:test-app_456')).toBe(false);
    });

    it('should handle very long scope strings', () => {
      const longScope =
        'org:very-long-organization-id-123:app:very-long-application-id-456:resource:very-long-resource-id-789:permission:very-long-permission-name';
      const regex = createScopeRegex(longScope);
      expect(regex.test(longScope)).toBe(true);
      expect(regex.test(longScope + ':extra')).toBe(true); // Should match prefix
    });

    it('should handle scope with mixed case (lowercased)', () => {
      // @ts-expect-error test for uppercase
      const regex = createScopeRegex('Org:Test123:App:Test456');
      expect(regex.test('Org:Test123:App:Test456')).toBe(false);
      expect(regex.test('org:test123:app:test456')).toBe(true);
    });
  });
});
