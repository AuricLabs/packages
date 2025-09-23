import { createAppScope } from './create-app-scope';

describe('createAppScope', () => {
  describe('should create app scope without org', () => {
    it('should create basic app scope with only appId', () => {
      const result = createAppScope('myapp');
      expect(result).toStrictEqual(['app', 'myapp']);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should create app scope with appId and other parts', () => {
      const result = createAppScope('myapp', undefined, 'feature', 'read');
      expect(result).toStrictEqual(['app', 'myapp', 'feature', 'read']);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should create app scope with multiple other parts', () => {
      const result = createAppScope('myapp', undefined, 'feature', 'read', 'write');
      expect(result).toStrictEqual(['app', 'myapp', 'feature', 'read', 'write']);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should create app scope with empty string appId', () => {
      const result = createAppScope('');
      expect(result).toStrictEqual(['app', '']);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should create app scope with numeric string appId', () => {
      const result = createAppScope('123');
      expect(result).toStrictEqual(['app', '123']);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should create app scope with special characters in appId', () => {
      const result = createAppScope('my-app_123');
      expect(result).toStrictEqual(['app', 'my-app_123']);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('should create app scope with org', () => {
    it('should create app scope with orgId and appId', () => {
      const result = createAppScope('myapp', 'org123');
      expect(result).toStrictEqual(['org', 'org123', 'app', 'myapp']);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should create app scope with orgId, appId, and other parts', () => {
      const result = createAppScope('myapp', 'org123', 'feature', 'read');
      expect(result).toStrictEqual(['org', 'org123', 'app', 'myapp', 'feature', 'read']);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should create app scope with orgId, appId, and multiple other parts', () => {
      const result = createAppScope('myapp', 'org123', 'feature', 'read', 'write');
      expect(result).toStrictEqual(['org', 'org123', 'app', 'myapp', 'feature', 'read', 'write']);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should create app scope with empty string orgId', () => {
      const result = createAppScope('myapp', '');
      expect(result).toStrictEqual(['org', '', 'app', 'myapp']);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should create app scope with numeric string orgId', () => {
      const result = createAppScope('myapp', '456');
      expect(result).toStrictEqual(['org', '456', 'app', 'myapp']);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should create app scope with special characters in orgId', () => {
      const result = createAppScope('myapp', 'org-123_test');
      expect(result).toStrictEqual(['org', 'org-123_test', 'app', 'myapp']);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should create app scope with very long orgId', () => {
      const longOrgId = 'a'.repeat(100);
      const result = createAppScope('myapp', longOrgId);
      expect(result).toStrictEqual(['org', longOrgId, 'app', 'myapp']);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should create app scope with very long appId', () => {
      const longAppId = 'b'.repeat(100);
      const result = createAppScope(longAppId, 'org123');
      expect(result).toStrictEqual(['org', 'org123', 'app', longAppId]);
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('should handle edge cases correctly', () => {
    it('should handle falsy orgId values', () => {
      expect(createAppScope('myapp', '')).toStrictEqual(['org', '', 'app', 'myapp']);
      expect(createAppScope('myapp', '0')).toStrictEqual(['org', '0', 'app', 'myapp']);
      expect(createAppScope('myapp', 'false')).toStrictEqual(['org', 'false', 'app', 'myapp']);
    });

    it('should handle empty other parts', () => {
      const result = createAppScope('myapp', 'org123');
      expect(result).toStrictEqual(['org', 'org123', 'app', 'myapp']);
    });

    it('should handle other parts with empty strings', () => {
      const result = createAppScope('myapp', 'org123', '', 'feature');
      expect(result).toStrictEqual(['org', 'org123', 'app', 'myapp', '', 'feature']);
    });

    it('should handle other parts with whitespace', () => {
      const result = createAppScope('myapp', 'org123', ' ', 'feature');
      expect(result).toStrictEqual(['org', 'org123', 'app', 'myapp', ' ', 'feature']);
    });

    it('should handle other parts with special characters', () => {
      const result = createAppScope('myapp', 'org123', 'feature-name', 'read_permission');
      expect(result).toStrictEqual([
        'org',
        'org123',
        'app',
        'myapp',
        'feature-name',
        'read_permission',
      ]);
    });
  });

  describe('should maintain immutability', () => {
    it('should return frozen array', () => {
      const result = createAppScope('myapp', 'org123');
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should return frozen array without org', () => {
      const result = createAppScope('myapp');
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should return frozen array with other parts', () => {
      const result = createAppScope('myapp', 'org123', 'feature', 'read');
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should prevent array modification', () => {
      const result = createAppScope('myapp', 'org123');
      expect(() => {
        // @ts-expect-error test - readonly array
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        result.push('newItem');
      }).toThrow();
    });
  });

  describe('should maintain type safety', () => {
    it('should return correct Scope type', () => {
      const result = createAppScope('myapp');
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toBe('app');
      expect(result[1]).toBe('myapp');
    });

    it('should return correct Scope type with org', () => {
      const result = createAppScope('myapp', 'org123');
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toBe('org');
      expect(result[1]).toBe('org123');
      expect(result[2]).toBe('app');
      expect(result[3]).toBe('myapp');
    });

    it('should work with const assertions', () => {
      const appId = 'myapp' as const;
      const orgId = 'org123' as const;
      const result = createAppScope(appId, orgId);
      expect(result).toStrictEqual(['org', 'org123', 'app', 'myapp']);
    });
  });

  describe('should handle integration with createOrgScope', () => {
    it('should use createOrgScope when orgId is provided', () => {
      const result = createAppScope('myapp', 'org123');
      // The result should start with ['org', 'org123'] which comes from createOrgScope
      expect(result.slice(0, 2)).toStrictEqual(['org', 'org123']);
      expect(result.slice(2)).toStrictEqual(['app', 'myapp']);
    });

    it('should not use createOrgScope when orgId is not provided', () => {
      const result = createAppScope('myapp');
      // The result should not contain org-related parts
      expect(result).toStrictEqual(['app', 'myapp']);
      expect(result).not.toContain('org');
    });

    it('should maintain correct order: org scope + app scope + other parts', () => {
      const result = createAppScope('myapp', 'org123', 'feature', 'read');
      expect(result).toStrictEqual(['org', 'org123', 'app', 'myapp', 'feature', 'read']);
    });
  });

  describe('should handle various input combinations', () => {
    it('should handle all parameters provided', () => {
      const result = createAppScope('myapp', 'org123', 'feature', 'read', 'write');
      expect(result).toStrictEqual(['org', 'org123', 'app', 'myapp', 'feature', 'read', 'write']);
    });

    it('should handle only appId and other parts (no orgId)', () => {
      const result = createAppScope('myapp', undefined, 'feature', 'read');
      expect(result).toStrictEqual(['app', 'myapp', 'feature', 'read']);
    });

    it('should handle only appId (no orgId, no other parts)', () => {
      const result = createAppScope('myapp');
      expect(result).toStrictEqual(['app', 'myapp']);
    });

    it('should handle appId with empty orgId and other parts', () => {
      const result = createAppScope('myapp', '', 'feature');
      expect(result).toStrictEqual(['org', '', 'app', 'myapp', 'feature']);
    });
  });
});
