import { createOrgScope } from './create-org-scope';
import { Scope } from './types';

describe('createOrgScope', () => {
  describe('with default parameter', () => {
    it('should create org scope with empty string when no orgId provided', () => {
      const result = createOrgScope();
      expect(result).toStrictEqual(['org', '']);
    });

    it('should create org scope with empty string when orgId is undefined', () => {
      const result = createOrgScope(undefined);
      expect(result).toStrictEqual(['org', '']);
    });
  });

  describe('with string orgId', () => {
    it('should create org scope with simple string orgId', () => {
      const result = createOrgScope('123');
      expect(result).toStrictEqual(['org', '123']);
    });

    it('should create org scope with UUID orgId', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = createOrgScope(uuid);
      expect(result).toStrictEqual(['org', uuid]);
    });

    it('should create org scope with numeric string orgId', () => {
      const result = createOrgScope('456');
      expect(result).toStrictEqual(['org', '456']);
    });

    it('should create org scope with alphanumeric orgId', () => {
      const result = createOrgScope('org123');
      expect(result).toStrictEqual(['org', 'org123']);
    });

    it('should create org scope with special characters in orgId', () => {
      const result = createOrgScope('org-123_456');
      expect(result).toStrictEqual(['org', 'org-123_456']);
    });

    it('should create org scope with empty string orgId', () => {
      const result = createOrgScope('');
      expect(result).toStrictEqual(['org', '']);
    });
  });

  describe('type safety', () => {
    it('should return a readonly tuple that satisfies Scope type', () => {
      const result = createOrgScope('123');

      // Verify it's a readonly tuple
      expect(Object.isFrozen(result)).toBe(true);

      // Verify the structure matches Scope type
      expect(result).toHaveLength(2);
      expect(result[0]).toBe('org');
      expect(result[1]).toBe('123');

      // Type assertion to ensure it satisfies Scope
      const scope: Scope = result;
      expect(scope).toStrictEqual(['org', '123']);
    });

    it('should maintain readonly constraint', () => {
      const result = createOrgScope('123');

      // Attempting to modify should fail at runtime (though TypeScript would prevent this)
      expect(() => {
        // @ts-expect-error test - readonly array
        result[0] = 'user';
      }).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle very long orgId', () => {
      const longOrgId = 'a'.repeat(1000);
      const result = createOrgScope(longOrgId);
      expect(result).toStrictEqual(['org', longOrgId]);
    });

    it('should handle orgId with spaces', () => {
      const result = createOrgScope('org 123');
      expect(result).toStrictEqual(['org', 'org 123']);
    });

    it('should handle orgId with unicode characters', () => {
      const result = createOrgScope('org-测试-123');
      expect(result).toStrictEqual(['org', 'org-测试-123']);
    });

    it('should handle orgId with emojis', () => {
      const result = createOrgScope('org-🚀-123');
      expect(result).toStrictEqual(['org', 'org-🚀-123']);
    });

    it('should handle orgId with newlines', () => {
      const result = createOrgScope('org\n123');
      expect(result).toStrictEqual(['org', 'org\n123']);
    });

    it('should handle orgId with tabs', () => {
      const result = createOrgScope('org\t123');
      expect(result).toStrictEqual(['org', 'org\t123']);
    });
  });

  describe('real-world scenarios', () => {
    it('should create scope for typical organization ID', () => {
      const result = createOrgScope('acme-corp');
      expect(result).toStrictEqual(['org', 'acme-corp']);
    });

    it('should create scope for enterprise organization', () => {
      const result = createOrgScope('enterprise-12345');
      expect(result).toStrictEqual(['org', 'enterprise-12345']);
    });

    it('should create scope for small business', () => {
      const result = createOrgScope('small-biz-001');
      expect(result).toStrictEqual(['org', 'small-biz-001']);
    });

    it('should create scope for government organization', () => {
      const result = createOrgScope('gov-department-xyz');
      expect(result).toStrictEqual(['org', 'gov-department-xyz']);
    });

    it('should create scope for educational institution', () => {
      const result = createOrgScope('university-abc');
      expect(result).toStrictEqual(['org', 'university-abc']);
    });
  });

  describe('integration with scope system', () => {
    it('should work with stringifyScope function', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports
      const { stringifyScope } = require('./stringify-scope');
      const orgScope = createOrgScope('123');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const stringified = stringifyScope(orgScope);
      expect(stringified).toBe('org:123');
    });

    it('should work with getIdFromScope function', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports
      const { getIdFromScope } = require('./get-id-from-scope');
      const orgScope = createOrgScope('123');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const orgId = getIdFromScope(orgScope, 'org');
      expect(orgId).toBe('123');
    });

    it('should work with mergeScopes function', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports
      const { mergeScopes } = require('./merge-scopes');
      const orgScope = createOrgScope('123');
      const appScope = ['app', '456'];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const merged = mergeScopes(orgScope, appScope);
      expect(merged).toStrictEqual([
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ]);
    });
  });

  describe('immutability', () => {
    it('should not allow modification of returned array', () => {
      const result = createOrgScope('123');

      // Verify it's immutable
      expect(() => {
        // @ts-expect-error test - readonly array
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        result.push('extra');
      }).toThrow();

      expect(() => {
        // @ts-expect-error test - readonly array
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        result.splice(0, 1);
      }).toThrow();

      expect(() => {
        // @ts-expect-error test - readonly array
        result.length = 3;
      }).toThrow();
    });

    it('should return new array on each call', () => {
      const result1 = createOrgScope('123');
      const result2 = createOrgScope('123');

      expect(result1).toStrictEqual(result2);
      expect(result1).not.toBe(result2); // Different array references
    });
  });

  describe('performance characteristics', () => {
    it('should handle multiple calls efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        createOrgScope(`org-${i}`);
      }

      const end = performance.now();
      const duration = end - start;

      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });
  });
});
