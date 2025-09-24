import { describe, it, expect } from '@jest/globals';

import { parsePermissionString } from './parse-permission-string';

describe('parsePermissionString', () => {
  describe('basic permission strings', () => {
    it('should parse a simple user:read permission', () => {
      const result = parsePermissionString('user:read');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
      });
    });

    it('should parse a simple org:manage permission', () => {
      const result = parsePermissionString('org:manage');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'manage',
        subject: 'org',
      });
    });

    it('should parse a simple app:create permission', () => {
      const result = parsePermissionString('app:create');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'create',
        subject: 'app',
      });
    });
  });

  describe('cannot permissions', () => {
    it('should parse a cannot permission with exclamation mark', () => {
      const result = parsePermissionString('!user:delete');

      expect(result).toStrictEqual({
        type: 'cannot',
        action: 'delete',
        subject: 'user',
      });
    });

    it('should parse a cannot permission for org', () => {
      const result = parsePermissionString('!org:update');

      expect(result).toStrictEqual({
        type: 'cannot',
        action: 'update',
        subject: 'org',
      });
    });
  });

  describe('multiple actions', () => {
    it('should parse multiple actions as an array', () => {
      const result = parsePermissionString('user:read,write');

      expect(result).toStrictEqual({
        type: 'can',
        action: ['read', 'write'],
        subject: 'user',
      });
    });

    it('should parse multiple actions with spaces', () => {
      const result = parsePermissionString('user:read , write , delete');

      expect(result).toStrictEqual({
        type: 'can',
        action: ['read', 'write', 'delete'],
        subject: 'user',
      });
    });

    it('should convert single action array to string', () => {
      const result = parsePermissionString('user:read,');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
      });
    });
  });

  describe('multiple subjects', () => {
    it('should parse multiple subjects as an array', () => {
      const result = parsePermissionString('user,org:read');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: ['user', 'org'],
      });
    });

    it('should parse multiple subjects with spaces', () => {
      const result = parsePermissionString('user , org , app:manage');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'manage',
        subject: ['user', 'org', 'app'],
      });
    });

    it('should convert single subject array to string', () => {
      const result = parsePermissionString('user,:read');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
      });
    });
  });

  describe('permissions with scope', () => {
    it('should parse permission with org scope', () => {
      const result = parsePermissionString('org:user:read');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
        scope: 'org',
      });
    });

    it('should parse permission with app scope', () => {
      const result = parsePermissionString('app:123:user:create');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'create',
        subject: 'user',
        scope: 'app:123',
      });
    });

    it('should parse permission with complex scope', () => {
      const result = parsePermissionString('org:456:app:789:role:assign');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'assign',
        subject: 'role',
        scope: 'org:456:app:789',
      });
    });
  });

  describe('permissions with conditions', () => {
    it('should parse permission with simple conditions', () => {
      const result = parsePermissionString('user:read{orgId:123}');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
        conditions: { orgId: 123 },
      });
    });

    it('should parse permission with multiple conditions', () => {
      const result = parsePermissionString('user:read{orgId:123,active:true}');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
        conditions: { orgId: 123, active: true },
      });
    });

    it('should parse permission with complex JSON conditions', () => {
      const result = parsePermissionString('user:read{filters:{"status":"active","role":"admin"}}');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
        conditions: { filters: { status: 'active', role: 'admin' } },
      });
    });

    it('should parse permission with array conditions', () => {
      const result = parsePermissionString('user:read{roles:["admin","user"],active:true}');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
        conditions: { roles: ['admin', 'user'], active: true },
      });
    });

    it('should parse permission with nested object conditions', () => {
      const result = parsePermissionString('user:read{query:{limit:10,offset:0,sort:"name"}}');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
        conditions: { query: { limit: 10, offset: 0, sort: 'name' } },
      });
    });

    it('should handle permission without conditions', () => {
      const result = parsePermissionString('user:read');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
      });
    });

    it('should handle permission with empty conditions object', () => {
      const result = parsePermissionString('user:read{}');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
        conditions: {},
      });
    });
  });

  describe('JSON parsing error handling', () => {
    it('should throw error for malformed JSON in conditions', () => {
      expect(() => parsePermissionString('user:read{invalid:json,}')).toThrow(
        "Invalid conditions string: '{invalid:json,}' for permission string: 'user:read{invalid:json,}'",
      );
    });

    it('should throw error for unclosed brace in conditions', () => {
      expect(() => parsePermissionString('user:read{orgId:123')).toThrow(
        "Invalid conditions string: '{orgId:123' for permission string: 'user:read{orgId:123'",
      );
    });

    it('should not throw an error for invalid JSON syntax in conditions', () => {
      const result = parsePermissionString('user:read{orgId:123,}');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
        conditions: { orgId: 123 },
      });
    });

    it('should not throw an error for trailing comma in conditions', () => {
      const result = parsePermissionString('user:read{orgId:123,active:true,}');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
        conditions: { orgId: 123, active: true },
      });
    });

    it('should throw error for invalid property names in conditions', () => {
      expect(() => parsePermissionString('user:read{123:value}')).toThrow(
        "Invalid conditions string: '{123:value}' for permission string: 'user:read{123:value}'",
      );
    });

    it('should throw error for unquoted string values in conditions', () => {
      expect(() => parsePermissionString('user:read{status:active}')).toThrow(
        "Invalid conditions string: '{status:active}' for permission string: 'user:read{status:active}'",
      );
    });

    it('should throw error for missing colon in conditions', () => {
      expect(() => parsePermissionString('user:read{orgId123}')).toThrow(
        "Invalid conditions string: '{orgId123}' for permission string: 'user:read{orgId123}'",
      );
    });

    it('should throw error for empty property name in conditions', () => {
      expect(() => parsePermissionString('user:read{:value}')).toThrow(
        "Invalid conditions string: '{:value}' for permission string: 'user:read{:value}'",
      );
    });

    it('should throw error for empty property value in conditions', () => {
      expect(() => parsePermissionString('user:read{orgId:}')).toThrow(
        "Invalid conditions string: '{orgId:}' for permission string: 'user:read{orgId:}'",
      );
    });
  });

  describe('complex combinations', () => {
    it('should parse cannot permission with scope, multiple actions, and conditions', () => {
      const result = parsePermissionString('!org:123:user,role:read,write{active:true,orgId:123}');

      expect(result).toStrictEqual({
        type: 'cannot',
        action: ['read', 'write'],
        subject: ['user', 'role'],
        scope: 'org:123',
        conditions: { active: true, orgId: 123 },
      });
    });

    it('should parse complex permission with all features', () => {
      const result = parsePermissionString(
        '!org:456:app:789:user,org:manage,read{filters:{"status":"active"},limit:10}',
      );

      expect(result).toStrictEqual({
        type: 'cannot',
        action: ['manage', 'read'],
        subject: ['user', 'org'],
        scope: 'org:456:app:789',
        conditions: { filters: { status: 'active' }, limit: 10 },
      });
    });

    it('should parse permission with complex nested conditions', () => {
      const result = parsePermissionString(
        'user:read{query:{filters:{status:"active",role:"admin"},pagination:{limit:10,offset:0},sort:{field:"name",direction:"asc"}}}',
      );

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
        conditions: {
          query: {
            filters: { status: 'active', role: 'admin' },
            pagination: { limit: 10, offset: 0 },
            sort: { field: 'name', direction: 'asc' },
          },
        },
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty action part', () => {
      expect(() => parsePermissionString('user:')).toThrow(
        "Invalid permission string format: 'user:'",
      );
    });

    it('should handle empty subject part', () => {
      expect(() => parsePermissionString(':read')).toThrow(
        "Invalid permission string format: ':read'",
      );
    });

    it('should handle completely empty string', () => {
      expect(() => parsePermissionString('')).toThrow("Invalid permission string format: ''");
    });

    it('should handle permission with only colon', () => {
      expect(() => parsePermissionString(':')).toThrow("Invalid permission string format: ':'");
    });

    it('should handle permission with empty conditions', () => {
      const result = parsePermissionString('user:read{}');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
        conditions: {},
      });
    });

    it('should handle permission with global scope', () => {
      const result = parsePermissionString(':user:read');

      expect(result).toStrictEqual({
        type: 'can',
        action: 'read',
        subject: 'user',
        scope: '',
      });
    });

    it('should handle permission with only opening brace', () => {
      expect(() => parsePermissionString('user:read{')).toThrow(
        "Invalid conditions string: '{' for permission string: 'user:read{'",
      );
    });

    it('should handle permission with only closing brace', () => {
      expect(() => parsePermissionString('user:read}')).toThrow(
        "Invalid conditions string: '}' for permission string: 'user:read}'",
      );
    });
  });

  describe('type safety', () => {
    it('should maintain proper typing for different permission types', () => {
      // Test that the function returns the correct type
      const userRead = parsePermissionString('user:read');
      const orgManage = parsePermissionString('org:manage');
      const appCreate = parsePermissionString('app:create');

      // These should all be valid Permission types
      expect(userRead).toHaveProperty('type');
      expect(userRead).toHaveProperty('action');
      expect(userRead).toHaveProperty('subject');

      expect(orgManage).toHaveProperty('type');
      expect(orgManage).toHaveProperty('action');
      expect(orgManage).toHaveProperty('subject');

      expect(appCreate).toHaveProperty('type');
      expect(appCreate).toHaveProperty('action');
      expect(appCreate).toHaveProperty('subject');
    });
  });

  describe('real-world examples', () => {
    it('should parse typical user management permissions', () => {
      const permissions = [
        'user:read',
        'user:create',
        'user:update',
        'user:delete',
        'user:invite',
        'user:remove',
      ];

      permissions.forEach((permission) => {
        const result = parsePermissionString(permission);
        expect(result.type).toBe('can');
        expect(result.subject).toBe('user');
        expect(result.action).toBe(permission.split(':')[1]);
      });
    });

    it('should parse typical org management permissions', () => {
      const permissions = ['org:manage', 'org:read', 'org:create', 'org:update', 'org:delete'];

      permissions.forEach((permission) => {
        const result = parsePermissionString(permission);
        expect(result.type).toBe('can');
        expect(result.subject).toBe('org');
        expect(result.action).toBe(permission.split(':')[1]);
      });
    });

    it('should parse typical app management permissions', () => {
      const permissions = [
        'app:manage',
        'app:read',
        'app:create',
        'app:update',
        'app:delete',
        'app:assign',
        'app:unassign',
      ];

      permissions.forEach((permission) => {
        const result = parsePermissionString(permission);
        expect(result.type).toBe('can');
        expect(result.subject).toBe('app');
        expect(result.action).toBe(permission.split(':')[1]);
      });
    });

    it('should parse permissions with real-world conditions', () => {
      const permissions = [
        'user:read{active:true,orgId:123}',
        'org:manage{role:"admin",permissions:["read","write"]}',
        'app:create{template:"default",settings:{"theme":"dark","notifications":true}}',
      ];

      permissions.forEach((permission) => {
        const result = parsePermissionString(permission);
        expect(result.conditions).toBeDefined();
        expect(typeof result.conditions).toBe('object');
      });
    });
  });
});
