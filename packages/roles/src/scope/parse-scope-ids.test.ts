import { describe, it, expect } from '@jest/globals';

import { parseScopeIds } from './parse-scope-ids';
import { Scope } from './types';

describe('parseScopeIds', () => {
  describe('function overloads', () => {
    it('should accept scope only parameter', () => {
      const result = parseScopeIds('org:123:app:myapp');
      expect(result).toStrictEqual({
        orgId: '123',
        appId: 'myapp',
      });
    });

    it('should accept scope and keys parameters', () => {
      const result = parseScopeIds('org:123:app:myapp', 'org', 'app');
      expect(result).toStrictEqual({
        orgId: '123',
        appId: 'myapp',
      });
    });

    it('should accept scope with default empty array', () => {
      const result = parseScopeIds();
      expect(result).toStrictEqual({});
    });
  });

  describe('should return empty object for falsy scopes', () => {
    it('should return empty object for undefined scope', () => {
      expect(parseScopeIds(undefined)).toStrictEqual({});
    });

    it('should return empty object for null scope', () => {
      expect(parseScopeIds(null as unknown as Scope)).toStrictEqual({});
    });

    it('should return empty object for empty string scope', () => {
      expect(parseScopeIds('')).toStrictEqual({});
    });

    it('should return empty object for empty array scope', () => {
      expect(parseScopeIds([])).toStrictEqual({});
    });
  });

  describe('should parse scope IDs correctly', () => {
    it('should parse single type-id pair', () => {
      expect(parseScopeIds('org:123')).toStrictEqual({
        orgId: '123',
      });
    });

    it('should parse multiple type-id pairs', () => {
      expect(parseScopeIds('org:123:app:myapp')).toStrictEqual({
        orgId: '123',
        appId: 'myapp',
      });
    });

    it('should parse type without id', () => {
      expect(parseScopeIds('org')).toStrictEqual({
        orgId: undefined,
      });
    });

    it('should parse mixed types with and without ids', () => {
      expect(parseScopeIds('org:123:app')).toStrictEqual({
        orgId: '123',
        appId: undefined,
      });
    });

    it('should parse complex nested scope', () => {
      expect(parseScopeIds('org:123:app:myapp:feature:subfeature')).toStrictEqual({
        orgId: '123',
        appId: 'myapp',
        featureId: 'subfeature',
      });
    });

    it('should handle string array scope', () => {
      expect(parseScopeIds(['org', '123', 'app', 'myapp'])).toStrictEqual({
        orgId: '123',
        appId: 'myapp',
      });
    });

    it('should handle scope subject array', () => {
      const scopeSubject: Scope = [
        { type: 'org', id: '123' },
        { type: 'app', id: 'myapp' },
      ];
      expect(parseScopeIds(scopeSubject)).toStrictEqual({
        orgId: '123',
        appId: 'myapp',
      });
    });
  });

  describe('should handle key validation correctly', () => {
    it('should return only requested keys when keys are specified', () => {
      const result = parseScopeIds('org:123:app:myapp:feature:subfeature', 'org', 'app');
      expect(result).toStrictEqual({
        orgId: '123',
        appId: 'myapp',
      });
      // @ts-expect-error test for undefined
      expect(result.featureId).toBeUndefined();
    });

    it('should throw error when requested key is not found', () => {
      expect(() => parseScopeIds('org:123', 'org', 'app')).toThrow('app is not defined in scope');
    });

    it('should throw error when multiple requested keys are not found', () => {
      expect(() => parseScopeIds('org:123', 'org', 'app', 'feature')).toThrow(
        'app is not defined in scope',
      );
    });

    it('should handle case-sensitive key matching', () => {
      // @ts-expect-error test for uppercase
      const result = parseScopeIds('ORG:123:APP:myapp', 'org', 'app');
      expect(result).toStrictEqual({
        orgId: '123',
        appId: 'myapp',
      });
    });

    it('should handle mixed case keys', () => {
      // @ts-expect-error test for uppercase
      const result = parseScopeIds('Org:123:App:myapp', 'org', 'app');
      expect(result).toStrictEqual({
        orgId: '123',
        appId: 'myapp',
      });
    });

    // New tests for a key that does not exist on the scope
    it('should throw error if a requested key does not exist in the scope', () => {
      expect(() => parseScopeIds('org:123:app:myapp', 'org', 'feature')).toThrow(
        'feature is not defined in scope',
      );
    });

    it('should throw error if all requested keys do not exist in the scope', () => {
      expect(() => parseScopeIds('org:123', 'feature', 'system')).toThrow(
        'feature is not defined in scope',
      );
    });

    it('should throw error if a requested key is not present in a scope subject array', () => {
      const scopeSubject: Scope = [
        { type: 'org', id: '123' },
        { type: 'app', id: 'myapp' },
      ];
      expect(() => parseScopeIds(scopeSubject, 'org', 'feature')).toThrow(
        'feature is not defined in scope',
      );
    });

    it('should throw error if a requested key is not present in a string array scope', () => {
      expect(() => parseScopeIds(['org', '123', 'app', 'myapp'], 'org', 'feature')).toThrow(
        'feature is not defined in scope',
      );
    });

    it('should throw error if a requested key is not present in an empty scope', () => {
      expect(() => parseScopeIds(undefined, 'org')).toThrow('org is not defined in scope');
    });
  });

  describe('should handle edge cases correctly', () => {
    it('should handle odd number of segments', () => {
      expect(parseScopeIds('org:123:app')).toStrictEqual({
        orgId: '123',
        appId: undefined,
      });
    });

    it('should handle empty segments in string', () => {
      expect(parseScopeIds('org::app:myapp')).toStrictEqual({
        orgId: undefined,
        appId: 'myapp',
      });
    });

    it('should handle empty segments in array', () => {
      expect(parseScopeIds(['org', '', 'app', 'myapp'])).toStrictEqual({
        orgId: undefined,
        appId: 'myapp',
      });
    });

    it('should handle whitespace in scope', () => {
      // @ts-expect-error test for whitespace
      expect(parseScopeIds(' org : 123 ')).toStrictEqual({
        orgId: '123',
      });
    });

    it('should handle duplicate types (last one wins)', () => {
      expect(parseScopeIds('org:123:org:456')).toStrictEqual({
        orgId: '456',
      });
    });

    it('should handle scope with only types (no ids)', () => {
      expect(parseScopeIds('org:app:feature')).toStrictEqual({
        orgId: 'app',
        featureId: undefined,
      });
    });
  });

  describe('should handle special scope types', () => {
    it('should handle system scope', () => {
      expect(parseScopeIds('system')).toStrictEqual({
        systemId: undefined,
      });
    });

    it('should handle org scope without id', () => {
      expect(parseScopeIds('org')).toStrictEqual({
        orgId: undefined,
      });
    });

    it('should handle app scope without id', () => {
      // @ts-expect-error test for undefined
      expect(parseScopeIds('app')).toStrictEqual({
        appId: undefined,
      });
    });

    it('should handle mixed scope types', () => {
      // @ts-expect-error test for mixed scope types
      expect(parseScopeIds('system:org:123:app:myapp')).toStrictEqual({
        systemId: 'org',
        '123Id': 'app',
        myappId: undefined,
      });
    });
  });

  describe('type safety and return types', () => {
    it('should return correct type for no keys specified', () => {
      const result = parseScopeIds('org:123:app:myapp');
      expect(typeof result.orgId).toBe('string');
      expect(typeof result.appId).toBe('string');
      expect(result.orgId).toBe('123');
      expect(result.appId).toBe('myapp');
    });

    it('should return correct type for specific keys', () => {
      const result = parseScopeIds('org:123:app:myapp', 'org', 'app');
      expect(typeof result.orgId).toBe('string');
      expect(typeof result.appId).toBe('string');
      expect(result.orgId).toBe('123');
      expect(result.appId).toBe('myapp');
    });

    it('should handle undefined ids correctly', () => {
      const result = parseScopeIds('org:app');
      expect(result.orgId).toBe('app');
      expect(result.appId).toBeUndefined();
    });

    it('should maintain key order in result object', () => {
      const result = parseScopeIds('org:123:app:myapp:feature:subfeature');
      const keys = Object.keys(result);
      expect(keys).toStrictEqual(['orgId', 'appId', 'featureId']);
    });
  });

  describe('integration with parseScope', () => {
    it('should work with parsed scope results', () => {
      const scope = 'org:123:app:myapp';
      const parsedScope = parseScopeIds(scope);

      expect(parsedScope).toStrictEqual({
        orgId: '123',
        appId: 'myapp',
      });
    });

    it('should handle scope subjects correctly', () => {
      const scopeSubject: Scope = [
        { type: 'org', id: '123' },
        { type: 'app', id: 'myapp' },
        { type: 'feature' },
      ];

      const result = parseScopeIds(scopeSubject);
      expect(result).toStrictEqual({
        orgId: '123',
        appId: 'myapp',
        featureId: undefined,
      });
    });
  });
});
