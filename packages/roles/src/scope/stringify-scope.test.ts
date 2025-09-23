import { stringifyScope } from './stringify-scope';
import { ScopeSubjectArray } from './types';

describe('stringifyScope', () => {
  describe('with undefined scope', () => {
    it('should return empty string when scope is undefined', () => {
      const result = stringifyScope(undefined);
      expect(result).toBe('');
    });

    it('should return empty string when scope is null', () => {
      // @ts-expect-error test for null
      const result = stringifyScope(null);
      expect(result).toBe('');
    });
  });

  describe('with string scopes', () => {
    it('should return string scope as-is', () => {
      const result = stringifyScope('org:123');
      expect(result).toBe('org:123');
    });

    it('should return empty string scope as-is', () => {
      const result = stringifyScope('');
      expect(result).toBe('');
    });

    it('should return system scope as-is', () => {
      const result = stringifyScope('system');
      expect(result).toBe('system');
    });

    it('should return complex string scope as-is', () => {
      const result = stringifyScope('org:123:app:456:read');
      expect(result).toBe('org:123:app:456:read');
    });

    it('should convert to lowercase', () => {
      // @ts-expect-error test for uppercase
      const result = stringifyScope('ORG:123:APP:456');
      expect(result).toBe('org:123:app:456');
    });
  });

  describe('with array string scopes', () => {
    it('should stringify simple array scope', () => {
      const result = stringifyScope(['org', '123']);
      expect(result).toBe('org:123');
    });

    it('should stringify empty array scope', () => {
      const result = stringifyScope([]);
      expect(result).toBe('');
    });

    it('should stringify single element array scope', () => {
      const result = stringifyScope(['system']);
      expect(result).toBe('system');
    });

    it('should stringify complex array scope', () => {
      const result = stringifyScope(['org', '123', 'app', '456', 'read']);
      expect(result).toBe('org:123:app:456:read');
    });

    it('should handle array with undefined id', () => {
      // @ts-expect-error test for undefined
      const result = stringifyScope(['org', '123', 'app']);
      expect(result).toBe('org:123:app');
    });

    it('should handle array with empty string id', () => {
      const result = stringifyScope(['org', '123', 'app', '']);
      expect(result).toBe('org:123:app:');
    });

    it('should convert to lowercase', () => {
      // @ts-expect-error test for uppercase
      const result = stringifyScope(['ORG', '123', 'APP', '456']);
      expect(result).toBe('org:123:app:456');
    });
  });

  describe('with ScopeSubjectArray scopes', () => {
    it('should stringify simple ScopeSubjectArray', () => {
      const scopeSubjects: ScopeSubjectArray = [{ type: 'org', id: '123' }];
      const result = stringifyScope(scopeSubjects);
      expect(result).toBe('org:123');
    });

    it('should stringify ScopeSubjectArray with multiple subjects', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ];
      const result = stringifyScope(scopeSubjects);
      expect(result).toBe('org:123:app:456');
    });

    it('should stringify ScopeSubjectArray with undefined id', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: 'app', id: undefined },
      ];
      const result = stringifyScope(scopeSubjects);
      expect(result).toBe('org:123:app');
    });

    it('should stringify ScopeSubjectArray with empty string id', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '123' },
        { type: 'app', id: '' },
      ];
      const result = stringifyScope(scopeSubjects);
      expect(result).toBe('org:123:app');
    });

    it('should stringify ScopeSubjectArray with system scope', () => {
      const scopeSubjects: ScopeSubjectArray = [{ type: 'system', id: undefined }];
      const result = stringifyScope(scopeSubjects);
      expect(result).toBe('system');
    });

    it('should stringify empty ScopeSubjectArray', () => {
      const scopeSubjects: ScopeSubjectArray = [];
      const result = stringifyScope(scopeSubjects);
      expect(result).toBe('');
    });

    it('should convert to lowercase', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'ORG', id: '123' },
        { type: 'APP', id: '456' },
      ];
      const result = stringifyScope(scopeSubjects);
      expect(result).toBe('org:123:app:456');
    });
  });

  describe('with variables replacement', () => {
    it('should replace variables in string scope', () => {
      const variables = { orgId: '123', appId: '456' };
      const result = stringifyScope('org:{orgId}:app:{appId}', variables);
      expect(result).toBe('org:123:app:456');
    });

    it('should replace variables in array scope', () => {
      const variables = { orgId: '123', appId: '456' };
      const result = stringifyScope(['org', '{orgId}', 'app', '{appId}'], variables);
      expect(result).toBe('org:123:app:456');
    });

    it('should replace variables in ScopeSubjectArray scope', () => {
      const variables = { orgId: '123', appId: '456' };
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '{orgId}' },
        { type: 'app', id: '{appId}' },
      ];
      const result = stringifyScope(scopeSubjects, variables);
      expect(result).toBe('org:123:app:456');
    });

    it('should handle undefined variables', () => {
      const variables = { orgId: '123', appId: undefined };
      const result = stringifyScope('org:{orgId}:app:{appId}', variables);
      expect(result).toBe('org:123:app:{appid}');
    });

    it('should handle empty variables object', () => {
      const variables = {};
      const result = stringifyScope('org:{orgId}:app:{appId}', variables);
      expect(result).toBe('org:{orgid}:app:{appid}');
    });

    it('should handle variables with special characters', () => {
      const variables = { 'org-id': '123', 'app-id': '456' };
      const result = stringifyScope('org:{org-id}:app:{app-id}', variables);
      expect(result).toBe('org:123:app:456');
    });

    it('should handle multiple occurrences of same variable', () => {
      const variables = { orgId: '123' };
      const result = stringifyScope('org:{orgId}:user:{orgId}', variables);
      expect(result).toBe('org:123:user:123');
    });

    it('should handle variables in complex nested scopes', () => {
      const variables = { orgId: '123', appId: '456', userId: '789' };
      const result = stringifyScope('org:{orgId}:app:{appId}:user:{userId}:read', variables);
      expect(result).toBe('org:123:app:456:user:789:read');
    });
  });

  describe('edge cases', () => {
    it('should handle array with mixed string and object types', () => {
      const scope = ['org', '123', { type: 'app', id: '456' }];
      // @ts-expect-error test for mixed string and object
      const result = stringifyScope(scope);
      expect(result).toBe('org:123:app:456');
    });

    it('should handle array with object at end', () => {
      const scope = ['org', '123', { type: 'app', id: '456' }];
      // @ts-expect-error test for mixed string and object
      const result = stringifyScope(scope);
      expect(result).toBe('org:123:app:456');
    });

    it('should handle array with object in middle', () => {
      const scope = ['org', '123', { type: 'app', id: '456' }, 'read'];
      // @ts-expect-error test for mixed string and object
      const result = stringifyScope(scope);
      expect(result).toBe('org:123:app:456:read');
    });

    it('should preserve order of elements', () => {
      const scope = ['app', '456', 'org', '123'];
      // @ts-expect-error test for mixed string and object
      const result = stringifyScope(scope);
      expect(result).toBe('app:456:org:123');
    });
  });

  describe('error cases', () => {
    it('should throw error for unsupported scope type', () => {
      expect(() => {
        // @ts-expect-error test for number
        stringifyScope(123);
      }).toThrow('Unsupported scope type number');
    });

    it('should throw error for boolean scope type', () => {
      expect(() => {
        // @ts-expect-error test for boolean
        stringifyScope(true);
      }).toThrow('Unsupported scope type boolean');
    });

    it('should throw error for object scope type', () => {
      expect(() => {
        // @ts-expect-error test for object
        stringifyScope({ invalid: 'scope' });
      }).toThrow('Unsupported scope type object');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical OIDC scope stringification', () => {
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'openid', id: undefined },
        { type: 'profile', id: undefined },
        { type: 'email', id: undefined },
        { type: 'org', id: '123' },
        { type: 'app', id: '456' },
      ];
      const result = stringifyScope(scopeSubjects);
      expect(result).toBe('openid::profile::email::org:123:app:456');
    });

    it('should handle organizational scope with variables', () => {
      const variables = { orgId: '123', appId: '456' };
      const scopeSubjects: ScopeSubjectArray = [
        { type: 'org', id: '{orgId}' },
        { type: 'app', id: '{appId}' },
        { type: 'read', id: undefined },
      ];
      const result = stringifyScope(scopeSubjects, variables);
      expect(result).toBe('org:123:app:456:read');
    });

    it('should handle complex nested scope with variables', () => {
      const variables = { orgId: '123', appId: '456', resourceId: '789' };
      const scope = `org:{orgId}:app:{appId}:resource:{resourceId}:manage`;
      const result = stringifyScope(scope, variables);
      expect(result).toBe('org:123:app:456:resource:789:manage');
    });
  });
});
