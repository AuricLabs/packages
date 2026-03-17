import { describe, it, expect } from 'vitest';

import { createScopeRegex } from './create-scope-regex';
import { ScopeSubjectArray } from './types';

describe('createScopeRegex', () => {
  describe('with string scopes', () => {
    it('should create regex for simple string scope', () => {
      const regex = createScopeRegex('org:123');
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.source).toBe('^org:123$');
    });

    it('should create regex for empty string scope', () => {
      const regex = createScopeRegex('');
      expect(regex.source).toBe('^$');
    });

    it('should create regex for system scope', () => {
      const regex = createScopeRegex('system');
      expect(regex.source).toBe('^system$');
    });

    it('should create regex for complex string scope', () => {
      const regex = createScopeRegex('org:123:app:456:read');
      expect(regex.source).toBe('^org:123:app:456:read$');
    });

    it('should handle string scope with single wildcards', () => {
      const regex = createScopeRegex('org:*:app:*');
      expect(regex.source).toBe('^org:[^:]*:app:[^:]*$');
    });

    it('should handle string scope with multiple single wildcards', () => {
      const regex = createScopeRegex('org:*:app:*:*');
      expect(regex.source).toBe('^org:[^:]*:app:[^:]*:[^:]*$');
    });

    it('should handle string scope starting with wildcard', () => {
      // @ts-expect-error test for wildcard
      const regex = createScopeRegex('*:123:app:456');
      expect(regex.source).toBe('^[^:]*:123:app:456$');
    });

    it('should handle string scope ending with single wildcard', () => {
      const regex = createScopeRegex('org:123:app:*');
      expect(regex.source).toBe('^org:123:app:[^:]*$');
    });

    it('should handle string scope with only single wildcards', () => {
      // @ts-expect-error test for wildcard
      const regex = createScopeRegex('*:*:*');
      expect(regex.source).toBe('^[^:]*:[^:]*:[^:]*$');
    });

    it('should handle double wildcard for descendants', () => {
      const regex = createScopeRegex('org:123:**');
      expect(regex.source).toBe('^org:123:.*$');
    });

    it('should handle double wildcard in middle of scope', () => {
      const regex = createScopeRegex('org:**:app:456');
      expect(regex.source).toBe('^org:.*:app:456$');
    });

    it('should handle mixed single and double wildcards', () => {
      const regex = createScopeRegex('org:*:app:**');
      expect(regex.source).toBe('^org:[^:]*:app:.*$');
    });
  });

  describe('with array scopes', () => {
    it('should create regex for simple array scope', () => {
      const regex = createScopeRegex(['org', '123']);
      expect(regex.source).toBe('^org:123$');
    });

    it('should create regex for empty array scope', () => {
      const regex = createScopeRegex([]);
      expect(regex.source).toBe('^$');
    });

    it('should create regex for single element array scope', () => {
      const regex = createScopeRegex(['system']);
      expect(regex.source).toBe('^system$');
    });

    it('should create regex for complex array scope', () => {
      const regex = createScopeRegex(['org', '123', 'app', '456', 'read']);
      expect(regex.source).toBe('^org:123:app:456:read$');
    });

    it('should handle array scope with wildcards', () => {
      const regex = createScopeRegex(['org', '*', 'app', '*']);
      expect(regex.source).toBe('^org:[^:]*:app:[^:]*$');
    });

    it('should handle array scope with mixed wildcards and values', () => {
      const regex = createScopeRegex(['org', '123', 'app', '*', 'read']);
      expect(regex.source).toBe('^org:123:app:[^:]*:read$');
    });

    it('should handle array scope with double wildcard', () => {
      const regex = createScopeRegex(['org', '123', '**']);
      expect(regex.source).toBe('^org:123:.*$');
    });
  });

  describe('with ScopeSubjectArray scopes', () => {
    it('should create regex for simple ScopeSubjectArray', () => {
      const scopeSubjects: ScopeSubjectArray = [{ type: 'org', id: '123' }];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^org:123$');
    });

    it('should create regex for ScopeSubjectArray with multiple subjects', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^org:123:app:456$');
    });

    it('should create regex for ScopeSubjectArray with undefined id', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: 'app', id: undefined },
      ];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^org:123:app$');
    });

    it('should create regex for ScopeSubjectArray with system scope', () => {
      const scopeSubjects: ScopeSubjectArray = [{ type: 'system', id: undefined }];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^system$');
    });

    it('should create regex for empty ScopeSubjectArray', () => {
      const scopeSubjects: ScopeSubjectArray = [];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^$');
    });

    it('should handle ScopeSubjectArray with wildcards in id', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '*' },
        { type: 'app', id: '456' },
      ];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^org:[^:]*:app:456$');
    });

    it('should handle ScopeSubjectArray with wildcards in type', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: '*', id: '123' },
        { type: 'app', id: '456' },
      ];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^[^:]*:123:app:456$');
    });

    it('should handle ScopeSubjectArray with double wildcard', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: '**', id: undefined },
      ];
      const regex = createScopeRegex(scopeSubjects);
      expect(regex.source).toBe('^org:123:.*$');
    });
  });

  describe('regex matching behavior - exact matching', () => {
    it('should match exact scope strings only', () => {
      const regex = createScopeRegex('org:123:app:456');
      expect(regex.test('org:123:app:456')).toBe(true);
      expect(regex.test('org:123:app:456:read')).toBe(false); // No longer matches - exact only
      expect(regex.test('org:123:app:789')).toBe(false);
      expect(regex.test('system')).toBe(false);
    });

    it('should not match prefix for simple scopes', () => {
      const regex = createScopeRegex('org:123');
      expect(regex.test('org:123')).toBe(true);
      expect(regex.test('org:123:app:456')).toBe(false); // Exact match only
      expect(regex.test('org:1234')).toBe(false);
    });

    it('should match wildcard patterns exactly', () => {
      const regex = createScopeRegex('org:*:app:456');
      expect(regex.test('org:123:app:456')).toBe(true);
      expect(regex.test('org:abc:app:456')).toBe(true);
      expect(regex.test('org:123:app:456:read')).toBe(false); // Exact match only
      expect(regex.test('org::app:456')).toBe(true); // Empty string matches [^:]*
      expect(regex.test('org:123:service:456')).toBe(false);
      expect(regex.test('system')).toBe(false);
    });

    it('should match multiple wildcards exactly', () => {
      const regex = createScopeRegex('org:*:app:*');
      expect(regex.test('org:123:app:456')).toBe(true);
      expect(regex.test('org:abc:app:xyz')).toBe(true);
      expect(regex.test('org::app:')).toBe(true);
      expect(regex.test('org:123:app:456:extra')).toBe(false); // Exact match only
      expect(regex.test('org:123:service:456')).toBe(false);
    });

    it('should handle wildcard at start exactly', () => {
      // @ts-expect-error test for wildcard
      const regex = createScopeRegex('*:123:app:456');
      expect(regex.test('org:123:app:456')).toBe(true);
      expect(regex.test('system:123:app:456')).toBe(true);
      expect(regex.test(':123:app:456')).toBe(true);
      expect(regex.test('org:456:app:456')).toBe(false);
    });

    it('should handle wildcard at end exactly', () => {
      const regex = createScopeRegex('org:123:app:*');
      expect(regex.test('org:123:app:456')).toBe(true);
      expect(regex.test('org:123:app:')).toBe(true);
      expect(regex.test('org:123:app:xyz')).toBe(true);
      expect(regex.test('org:123:app:456:read')).toBe(false); // Exact match only
      expect(regex.test('org:123:service:456')).toBe(false);
    });

    it('should handle only wildcards exactly', () => {
      // @ts-expect-error test for wildcard
      const regex = createScopeRegex('*:*:*');
      expect(regex.test('org:123:app')).toBe(true);
      expect(regex.test('system:456:read')).toBe(true);
      expect(regex.test(':::')).toBe(false); // 4 segments, not 3
      expect(regex.test('one:two')).toBe(false); // Should not match fewer segments
      expect(regex.test('one:two:three:four')).toBe(false); // Should not match more segments
    });

    it('should handle system scope exactly', () => {
      const regex = createScopeRegex('system');
      expect(regex.test('system')).toBe(true);
      expect(regex.test('system:read')).toBe(false); // Exact match only
      expect(regex.test('org:system')).toBe(false);
    });

    it('should handle empty scope exactly', () => {
      const regex = createScopeRegex('');
      expect(regex.test('')).toBe(true);
      expect(regex.test('org:123')).toBe(false); // Exact match only
      expect(regex.test('system')).toBe(false);
    });

    it('should be case-sensitive as input (stringifyScope handles case)', () => {
      // @ts-expect-error test for uppercase
      const regex = createScopeRegex('ORG:123');
      expect(regex.test('ORG:123')).toBe(false);
      expect(regex.test('org:123')).toBe(true);
    });

    it('should not match across colon boundaries with single wildcards', () => {
      const regex = createScopeRegex('org:*:app');
      expect(regex.test('org:123:app')).toBe(true);
      expect(regex.test('org:123:456:app')).toBe(false); // * should not match across colons
      expect(regex.test('org::app')).toBe(true);
    });
  });

  describe('double wildcard (**) behavior - descendants only', () => {
    it('should match descendants but not the base scope', () => {
      const regex = createScopeRegex('org:123:**');
      expect(regex.test('org:123')).toBe(false); // Base scope NOT matched
      expect(regex.test('org:123:app:456')).toBe(true); // Descendant matched
      expect(regex.test('org:123:app:456:project:789')).toBe(true); // Deep descendant matched
    });

    it('should require at least one character after the colon', () => {
      const regex = createScopeRegex('org:123:**');
      expect(regex.test('org:123:')).toBe(true); // Empty segment is valid
      expect(regex.test('org:123')).toBe(false); // No colon after = not matched
    });

    it('should match any depth of nesting', () => {
      const regex = createScopeRegex('org:123:**');
      expect(regex.test('org:123:a')).toBe(true);
      expect(regex.test('org:123:a:b')).toBe(true);
      expect(regex.test('org:123:a:b:c')).toBe(true);
      expect(regex.test('org:123:a:b:c:d:e:f')).toBe(true);
    });

    it('should work with double wildcard in middle of scope', () => {
      const regex = createScopeRegex('org:**:app:456');
      expect(regex.test('org:123:app:456')).toBe(true);
      expect(regex.test('org:foo:bar:app:456')).toBe(true);
      expect(regex.test('org::app:456')).toBe(true);
      expect(regex.test('org:app:456')).toBe(false); // Needs the colon after org
    });

    it('should work with mixed single and double wildcards', () => {
      const regex = createScopeRegex('org:*:app:**');
      expect(regex.test('org:123:app:456')).toBe(true);
      expect(regex.test('org:123:app:456:project:789')).toBe(true);
      expect(regex.test('org:123:app')).toBe(false); // ** requires something after
      expect(regex.test('org:123:456:app:789')).toBe(false); // Single * doesn't cross colons
    });

    it('should handle double wildcard at different positions', () => {
      // At the end - descendants of org:123
      const regex1 = createScopeRegex('org:123:**');
      expect(regex1.test('org:123:anything:here')).toBe(true);
      expect(regex1.test('org:123')).toBe(false);

      // In the middle - any path between org and app:456
      const regex2 = createScopeRegex('org:**:app:456');
      expect(regex2.test('org:foo:bar:baz:app:456')).toBe(true);

      // Multiple double wildcards
      const regex3 = createScopeRegex('org:**:app:**');
      expect(regex3.test('org:a:b:app:c:d')).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle org admin with descendants access', () => {
      // Org admin can access org:123 AND descendants
      const exactRegex = createScopeRegex('org:123');
      const descendantsRegex = createScopeRegex('org:123:**');

      // Exact permission matches org level only
      expect(exactRegex.test('org:123')).toBe(true);
      expect(exactRegex.test('org:123:app:456')).toBe(false);

      // Descendants permission matches apps within org
      expect(descendantsRegex.test('org:123')).toBe(false);
      expect(descendantsRegex.test('org:123:app:456')).toBe(true);
      expect(descendantsRegex.test('org:123:app:456:project:789')).toBe(true);
    });

    it('should handle app admin with descendants access', () => {
      const exactRegex = createScopeRegex('org:123:app:456');
      const descendantsRegex = createScopeRegex('org:123:app:456:**');

      // Exact permission matches app level only
      expect(exactRegex.test('org:123:app:456')).toBe(true);
      expect(exactRegex.test('org:123:app:456:project:789')).toBe(false);

      // Descendants permission matches projects within app
      expect(descendantsRegex.test('org:123:app:456')).toBe(false);
      expect(descendantsRegex.test('org:123:app:456:project:789')).toBe(true);
    });

    it('should handle organizational scope patterns exactly', () => {
      const regex = createScopeRegex('org:*');
      expect(regex.test('org:123')).toBe(true);
      expect(regex.test('org:456')).toBe(true);
      expect(regex.test('org:123:app:456')).toBe(false); // Exact match only
      expect(regex.test('app:123')).toBe(false);
    });

    it('should handle permission checking patterns', () => {
      // @ts-expect-error test for wildcard
      const regex = createScopeRegex('*:*:*:manage');
      expect(regex.test('org:123:app:manage')).toBe(true);
      expect(regex.test('org:456:user:manage')).toBe(true);
      expect(regex.test('system:admin:role:manage')).toBe(true);
      expect(regex.test('org:123:app:read')).toBe(false);
      expect(regex.test('org:123:app:manage:extra')).toBe(false); // Exact match only
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
      expect(regex.test('org:123:app:456:resource:789:read:extra')).toBe(false); // Exact match
    });

    it('should handle wildcard for any org with descendants', () => {
      const regex = createScopeRegex('org:*:**');
      expect(regex.test('org:123:app:456')).toBe(true);
      expect(regex.test('org:456:app:789:project:abc')).toBe(true);
      expect(regex.test('org:123')).toBe(false); // ** requires descendants
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
      expect(regex.test(longScope + ':extra')).toBe(false); // Exact match only
    });

    it('should handle scope with mixed case (lowercased)', () => {
      // @ts-expect-error test for uppercase
      const regex = createScopeRegex('Org:Test123:App:Test456');
      expect(regex.test('Org:Test123:App:Test456')).toBe(false);
      expect(regex.test('org:test123:app:test456')).toBe(true);
    });

    it('should handle double wildcard without preceding scope', () => {
      // @ts-expect-error test for wildcard starting scope
      const regex = createScopeRegex('**');
      // This becomes just .* which matches anything
      expect(regex.source).toBe('^[^:]*[^:]*$'); // ** without : prefix is just two single *
    });

    it('should differentiate between * and ** correctly', () => {
      const singleWildcard = createScopeRegex('org:*');
      const doubleWildcard = createScopeRegex('org:**');

      // Single wildcard - matches one segment
      expect(singleWildcard.test('org:123')).toBe(true);
      expect(singleWildcard.test('org:123:app')).toBe(false);

      // Double wildcard - matches descendants
      expect(doubleWildcard.test('org:123')).toBe(true); // :.*$ matches :123
      expect(doubleWildcard.test('org:123:app')).toBe(true);
      expect(doubleWildcard.test('org:123:app:456')).toBe(true);
    });
  });
});
