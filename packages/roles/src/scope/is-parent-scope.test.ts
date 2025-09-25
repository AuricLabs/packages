import { describe, it, expect } from 'vitest';

import { isParentScope } from './is-parent-scope';
import { Scope, ScopeSubjectArray } from './types';

describe('isParentScope', () => {
  describe('should return true for valid parent-child relationships', () => {
    it('should return true when parent and child are identical', () => {
      expect(isParentScope('org:123', 'org:123')).toBe(true);
      expect(isParentScope(['org', '123'], ['org', '123'])).toBe(true);
    });

    it('should return true when parent is less specific than child', () => {
      expect(isParentScope('org:123', 'org:123:app:456')).toBe(true);
      expect(isParentScope('org:123:app:456', 'org:123:app:456:read')).toBe(true);
    });

    it('should return true when parent has wildcard IDs', () => {
      expect(isParentScope('org:*', 'org:123')).toBe(true);
      expect(isParentScope('org:*:app:*', 'org:123:app:456')).toBe(true);
      expect(isParentScope('org:123:app:*', 'org:123:app:456')).toBe(true);
    });

    it('should return true for empty parent scope (global)', () => {
      expect(isParentScope('', 'org:123')).toBe(true);
      expect(isParentScope('', 'org:123:app:456')).toBe(true);
      expect(isParentScope([], ['org', '123'])).toBe(true);
    });

    it('should return true for system scope as parent', () => {
      // @ts-expect-error test for string parent
      expect(isParentScope('system', 'system:admin')).toBe(true);
      // @ts-expect-error test for array parent
      expect(isParentScope(['system'], ['system', 'admin'])).toBe(true);
    });

    it('should return true for complex nested scopes', () => {
      expect(isParentScope('org:123:app:456', 'org:123:app:456:resource:789:read')).toBe(true);

      expect(isParentScope('org:*:app:456', 'org:123:app:456:resource:789:read')).toBe(true);
    });

    it('should return true when using different scope formats', () => {
      expect(isParentScope('org:123', ['org', '123', 'app', '456'])).toBe(true);
      expect(isParentScope(['org', '123'], 'org:123:app:456')).toBe(true);

      const parentScope: ScopeSubjectArray = [{ type: 'org', id: '123' }];
      const childScope: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ];
      expect(isParentScope(parentScope, childScope)).toBe(true);
    });
  });

  describe('should return false for invalid parent-child relationships', () => {
    it('should return false when parent is more specific than child', () => {
      expect(isParentScope('org:123:app:456', 'org:123')).toBe(false);
      expect(isParentScope('org:123:app:456:read', 'org:123:app:456')).toBe(false);
    });

    it('should return false when types do not match', () => {
      expect(isParentScope('org:123', 'app:123')).toBe(false);
      expect(isParentScope('org:123:app:456', 'org:123:user:456')).toBe(false);
      expect(isParentScope('system', 'org:123')).toBe(false);
    });

    it('should return false when IDs do not match (without wildcards)', () => {
      expect(isParentScope('org:123', 'org:456')).toBe(false);
      expect(isParentScope('org:123:app:456', 'org:123:app:789')).toBe(false);
      expect(isParentScope('org:123:app:456', 'org:456:app:456')).toBe(false);
    });

    it('should return false when parent has different structure', () => {
      expect(isParentScope('app:456', 'org:123:app:456')).toBe(false);
      expect(isParentScope('org:123:user:789', 'org:123:app:456')).toBe(false);
    });

    it('should return false for completely different scopes', () => {
      expect(isParentScope('org:123:app:456', 'org:789:user:999')).toBe(false);
      // @ts-expect-error test for string parent
      expect(isParentScope('system:admin', 'org:123')).toBe(false);
    });
  });

  describe('should handle wildcard scenarios correctly', () => {
    it('should handle single wildcard in parent', () => {
      expect(isParentScope('org:*', 'org:123')).toBe(true);
      expect(isParentScope('org:*', 'org:456')).toBe(true);
      expect(isParentScope('org:*', 'org:')).toBe(true);
      expect(isParentScope('app:*', 'app:myapp')).toBe(true);
    });

    it('should handle multiple wildcards in parent', () => {
      expect(isParentScope('org:*:app:*', 'org:123:app:456')).toBe(true);
      expect(isParentScope('org:*:app:*', 'org:789:app:xyz')).toBe(true);
      expect(isParentScope('org:*:app:*:read', 'org:123:app:456:read')).toBe(true);
    });

    it('should handle mixed wildcards and specific IDs', () => {
      expect(isParentScope('org:*:app:456', 'org:123:app:456')).toBe(true);
      expect(isParentScope('org:123:app:*', 'org:123:app:456')).toBe(true);
      expect(isParentScope('org:*:app:456', 'org:123:app:789')).toBe(false);
    });

    it('should not allow wildcard to match different types', () => {
      expect(isParentScope('org:*', 'app:123')).toBe(false);
      expect(isParentScope('org:*:app:*', 'org:123:user:456')).toBe(false);
    });
  });

  describe('should handle edge cases correctly', () => {
    it('should handle empty scopes', () => {
      expect(isParentScope('', '')).toBe(true);
      expect(isParentScope([], [])).toBe(true);
      expect(isParentScope('', 'org:123')).toBe(true);
      expect(isParentScope([], ['org', '123'])).toBe(true);
    });

    it('should handle undefined parent scope', () => {
      // @ts-expect-error test for string parent
      expect(isParentScope(undefined, 'org:123')).toBe(true);
      // @ts-expect-error test for undefined parent
      expect(isParentScope(undefined, undefined)).toBe(true);
    });

    it('should handle system scope edge cases', () => {
      expect(isParentScope('system', 'system')).toBe(true);
      expect(isParentScope(['system'], ['system'])).toBe(true);
      // @ts-expect-error test for string parent
      expect(isParentScope('system', 'system:admin:read')).toBe(true);
    });

    it('should handle scopes with undefined IDs', () => {
      const parentScope: ScopeSubjectArray = [{ type: 'org', id: undefined }];
      const childScope: ScopeSubjectArray = [
        { type: 'org', id: undefined },
        { type: 'app', id: '456' },
      ];
      expect(isParentScope(parentScope, childScope)).toBe(true);
    });

    it('should handle scopes with empty string IDs', () => {
      expect(isParentScope('org:', 'org::app:456')).toBe(true);
      expect(isParentScope(['org', ''], ['org', '', 'app', '456'])).toBe(true);
    });
  });

  describe('should handle different scope formats correctly', () => {
    it('should work with string parent and array child', () => {
      expect(isParentScope('org:123', ['org', '123', 'app', '456'])).toBe(true);
      expect(isParentScope('org:*', ['org', '123', 'app', '456'])).toBe(true);
      expect(isParentScope('org:456', ['org', '123', 'app', '456'])).toBe(false);
    });

    it('should work with array parent and string child', () => {
      expect(isParentScope(['org', '123'], 'org:123:app:456')).toBe(true);
      expect(isParentScope(['org', '*'], 'org:123:app:456')).toBe(true);
      expect(isParentScope(['org', '456'], 'org:123:app:456')).toBe(false);
    });

    it('should work with ScopeSubjectArray formats', () => {
      const parentScope: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: 'app', id: '*' },
      ];
      const childScope: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
        { type: 'read', id: undefined },
      ];
      expect(isParentScope(parentScope, childScope)).toBe(true);
    });

    it('should work with mixed ScopeSubject and string formats', () => {
      const parentScope: ScopeSubjectArray = [{ type: 'org', id: '*' }];
      expect(isParentScope(parentScope, 'org:123:app:456')).toBe(true);
      expect(
        isParentScope('org:*', [
          { type: 'org', id: '123' },
          { type: 'app', id: '456' },
        ]),
      ).toBe(true);
    });
  });

  describe('should handle case sensitivity correctly', () => {
    it('should handle mixed case input (normalized to lowercase)', () => {
      // Note: parseScope normalizes to lowercase
      // @ts-expect-error test for string parent
      expect(isParentScope('ORG:123', 'org:123:app:456')).toBe(true);
      // @ts-expect-error test for string parent
      expect(isParentScope('org:123', 'ORG:123:APP:456')).toBe(true);
      expect(
        // @ts-expect-error test for array parent
        isParentScope(['ORG', '123'], ['org', '123', 'app', '456']),
      ).toBe(true);
    });
  });

  describe('should handle real-world permission scenarios', () => {
    it('should handle organizational permission hierarchies', () => {
      // Global admin can access any org
      expect(isParentScope('', 'org:123')).toBe(true);

      // Org admin can access specific org and its apps
      expect(isParentScope('org:123', 'org:123:app:456')).toBe(true);
      expect(isParentScope('org:123', 'org:123:user:789')).toBe(true);

      // App admin can only access specific app
      expect(isParentScope('org:123:app:456', 'org:123:app:456:read')).toBe(true);
      expect(isParentScope('org:123:app:456', 'org:123:app:789')).toBe(false);
    });

    it('should handle wildcard permission patterns', () => {
      // User with wildcard org access
      expect(isParentScope('org:*:read', 'org:123:read')).toBe(true);
      expect(isParentScope('org:*:read', 'org:456:read')).toBe(true);

      // User with wildcard app access within specific org
      expect(isParentScope('org:123:app:*', 'org:123:app:456')).toBe(true);
      expect(isParentScope('org:123:app:*', 'org:123:app:789')).toBe(true);
      expect(isParentScope('org:123:app:*', 'org:456:app:789')).toBe(false);
    });

    it('should handle resource-level permissions', () => {
      // User with read access to specific resource
      expect(
        isParentScope('org:123:app:456:resource:789', 'org:123:app:456:resource:789:read'),
      ).toBe(true);

      // User with wildcard resource access
      expect(isParentScope('org:123:app:456:resource:*', 'org:123:app:456:resource:789:read')).toBe(
        true,
      );

      // User cannot access different resource
      expect(
        isParentScope('org:123:app:456:resource:789', 'org:123:app:456:resource:999:read'),
      ).toBe(false);
    });

    it('should handle multi-tenant scenarios', () => {
      // Tenant isolation - user from org 123 cannot access org 456
      expect(isParentScope('org:123', 'org:456:app:789')).toBe(false);

      // App isolation within same org
      expect(isParentScope('org:123:app:456', 'org:123:app:789:read')).toBe(false);

      // Cross-tenant admin with wildcard access
      expect(isParentScope('org:*', 'org:123:app:456')).toBe(true);
      expect(isParentScope('org:*', 'org:456:user:789')).toBe(true);
    });

    it('should handle service-to-service permissions', () => {
      // Service with broad access
      // @ts-expect-error test for string parent
      expect(isParentScope('service:api:*', 'service:api:read')).toBe(true);
      // @ts-expect-error test for string parent
      expect(isParentScope('service:api:*', 'service:api:write')).toBe(true);

      // Service with limited access
      // @ts-expect-error test for string parent
      expect(isParentScope('service:api:read', 'service:api:read:users')).toBe(true);
      // @ts-expect-error test for string parent
      expect(isParentScope('service:api:read', 'service:api:write:users')).toBe(false);
    });
  });

  describe('should handle complex nested scenarios', () => {
    it('should handle deeply nested scopes', () => {
      const parent = 'org:123:app:456:module:auth:feature:users';
      const child = 'org:123:app:456:module:auth:feature:users:action:read';
      expect(isParentScope(parent, child)).toBe(true);

      const invalidChild = 'org:123:app:456:module:auth:feature:roles:action:read';
      expect(isParentScope(parent, invalidChild)).toBe(false);
    });

    it('should handle mixed wildcard patterns in nested scopes', () => {
      expect(
        isParentScope('org:*:app:456:module:*', 'org:123:app:456:module:auth:feature:users'),
      ).toBe(true);

      expect(
        isParentScope('org:123:app:*:module:auth', 'org:123:app:456:module:auth:feature:users'),
      ).toBe(true);

      expect(
        isParentScope('org:123:app:*:module:billing', 'org:123:app:456:module:auth:feature:users'),
      ).toBe(false);
    });
  });

  describe('type safety', () => {
    it('should accept all valid Scope types', () => {
      // These should compile without TypeScript errors
      const stringParent: Scope = 'org:123';
      const arrayParent: Scope = ['org', '123'];
      const subjectParent: Scope = [{ type: 'org', id: '123' }];

      const stringChild: Scope = 'org:123:app:456';
      const arrayChild: Scope = ['org', '123', 'app', '456'];
      const subjectChild: Scope = [
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ];

      expect(typeof isParentScope(stringParent, stringChild)).toBe('boolean');
      expect(typeof isParentScope(arrayParent, arrayChild)).toBe('boolean');
      expect(typeof isParentScope(subjectParent, subjectChild)).toBe('boolean');
    });

    it('should work with const assertions', () => {
      const parent = 'org:123' as const;
      const child = 'org:123:app:456' as const;
      expect(isParentScope(parent, child)).toBe(true);
    });
  });

  describe('performance considerations', () => {
    it('should handle large scope hierarchies efficiently', () => {
      const longParent = 'org:123:app:456:module:auth:feature:users:permission:read';
      const longChild = (longParent + ':action:view:data:sensitive') as Scope;

      const start = performance.now();
      const result = isParentScope(longParent, longChild);
      const end = performance.now();

      expect(result).toBe(true);
      expect(end - start).toBeLessThan(10); // Should be very fast
    });

    it('should handle multiple calls efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        isParentScope('org:*', `org:${String(i)}:app:test` as Scope);
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(100); // Should handle 1000 calls quickly
    });
  });
});
