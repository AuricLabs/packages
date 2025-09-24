import { describe, it, expect } from '@jest/globals';

import { ScopeString } from '../scope';

import { flattenPermissions } from './flatten-permissions';
import { permissionGroup } from './permission-group';
import { permission } from './permission-proxy';
import { PermissionOrGroupOrString, Permission, PermissionGroup } from './types';

describe('flattenPermissions', () => {
  const flattenPermissionsCompat = (...args: Parameters<typeof flattenPermissions>) => {
    const result = flattenPermissions(...args);
    return result.slice();
  };

  describe('basic functionality', () => {
    it('should return empty array for empty permissions array', () => {
      const result = flattenPermissionsCompat([]);
      expect(result).toStrictEqual([]);
    });

    it('should return single permission as-is', () => {
      const userRead = permission.user.read;

      const result = flattenPermissionsCompat([permission.user.read]);
      expect(result).toStrictEqual([userRead]);
    });

    it('should return multiple permissions as-is when no groups', () => {
      const permissions = [
        permission({ subject: 'user', action: 'read', type: 'can' }),
        permission({ subject: 'org', action: 'create', type: 'can' }),
      ];

      const result = flattenPermissionsCompat(permissions);
      expect(result).toStrictEqual(permissions);
    });
  });

  describe('string permission parsing', () => {
    it('should parse simple permission string', () => {
      const result = flattenPermissionsCompat(['user:read']);

      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
      });
    });

    it('should parse permission string with conditions', () => {
      const result = flattenPermissionsCompat(['user:read{active:true}']);

      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: { active: true },
      });
    });

    it('should parse permission string with scope', () => {
      const result = flattenPermissionsCompat(['org:123:user:read']);

      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
        scope: 'org:123',
      });
    });

    it('should parse permission string with type "cannot"', () => {
      const result = flattenPermissionsCompat(['!user:delete']);

      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual({
        subject: 'user',
        action: 'delete',
        type: 'cannot',
      });
    });

    it('should parse permission string with multiple subjects and actions', () => {
      const result = flattenPermissionsCompat(['user,org:read,create']);

      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual({
        subject: ['user', 'org'],
        action: ['read', 'create'],
        type: 'can',
      });
    });
  });

  describe('group flattening', () => {
    it('should flatten simple group with permissions', () => {
      const group: PermissionGroup<'user', 'read' | 'create', 'can'> = {
        permissions: [
          { subject: 'user', action: 'read', type: 'can' },
          { subject: 'user', action: 'create', type: 'can' },
        ],
      };

      const result = flattenPermissionsCompat([group]);

      expect(result).toHaveLength(2);
      expect(result[0]).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
      });
      expect(result[1]).toStrictEqual({
        subject: 'user',
        action: 'create',
        type: 'can',
      });
    });

    it('should flatten group with nested groups', () => {
      const nestedGroup: PermissionGroup<'user', 'read' | 'create', 'can'> = {
        permissions: [{ subject: 'user', action: 'read', type: 'can' }],
      };

      const group: PermissionGroup<'user', 'read' | 'create', 'can'> = {
        permissions: [{ subject: 'user', action: 'create', type: 'can' }, nestedGroup],
      };

      const result = flattenPermissionsCompat([group]);

      expect(result).toHaveLength(2);
      expect(result[0]).toStrictEqual({
        subject: 'user',
        action: 'create',
        type: 'can',
      });
      expect(result[1]).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
      });
    });

    it('should handle deeply nested groups', () => {
      const level3: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [{ subject: 'user', action: 'read', type: 'can' }],
      };

      const level2: PermissionGroup<'user', 'read' | 'create', 'can'> = {
        permissions: [{ subject: 'user', action: 'create', type: 'can' }, level3],
      };

      const level1: PermissionGroup<'user', 'read' | 'create' | 'update', 'can'> = {
        permissions: [{ subject: 'user', action: 'update', type: 'can' }, level2],
      };

      const result = flattenPermissionsCompat([level1]);

      expect(result).toHaveLength(3);
      expect(result[0]).toStrictEqual({
        subject: 'user',
        action: 'update',
        type: 'can',
      });
      expect(result[1]).toStrictEqual({
        subject: 'user',
        action: 'create',
        type: 'can',
      });
      expect(result[2]).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
      });
    });

    it('should handle mixed content in groups', () => {
      const group = permissionGroup({
        permissions: [
          permission.user.read,
          permission.org.create,
          {
            permissions: [permission.user.update, permission.org.create],
          },
        ],
      });

      const result = flattenPermissionsCompat([group]);

      expect(result).toHaveLength(4);
      expect(result[0]).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
      });
      expect(result[1]).toStrictEqual({
        subject: 'org',
        action: 'create',
        type: 'can',
      });
      expect(result[2]).toStrictEqual({
        subject: 'user',
        action: 'update',
        type: 'can',
      });
      expect(result[3]).toStrictEqual({
        subject: 'org',
        action: 'create',
        type: 'can',
      });
    });
  });

  describe('conditions merging', () => {
    it('should merge group conditions with permission conditions', () => {
      const group: PermissionGroup<'user', 'read', 'can'> = {
        conditions: { orgId: '123' },
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
            conditions: { userId: '456' },
          },
        ],
      };

      const result = flattenPermissionsCompat([group]);

      expect(result).toHaveLength(1);
      expect(result[0].conditions).toStrictEqual({
        orgId: '123',
        userId: '456',
      });
    });

    it('should merge additional conditions when provided', () => {
      const group: PermissionGroup<'user', 'read', 'can'> = {
        conditions: { orgId: '123' },
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
            conditions: { userId: '456' },
          },
        ],
      };

      const additionalConditions = { tenantId: '789' };
      const result = flattenPermissionsCompat([group], { additionalConditions });

      expect(result).toHaveLength(1);
      expect(result[0].conditions).toStrictEqual({
        tenantId: '789',
        orgId: '123',
        userId: '456',
      });
    });

    it('should handle undefined conditions gracefully', () => {
      const group: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [{ subject: 'user', action: 'read', type: 'can' }],
      };

      const result = flattenPermissionsCompat([group]);

      expect(result).toHaveLength(1);
      expect(result[0].conditions).toBeUndefined();
    });

    it('should handle complex condition merging', () => {
      const group: PermissionGroup<'user', 'read', 'can'> = {
        conditions: {
          $and: [{ orgId: '123' }, { active: true }],
        },
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
            conditions: {
              $or: [{ role: 'admin' }, { role: 'manager' }],
            },
          },
        ],
      };

      const additionalConditions = { tenantId: '789' };
      const result = flattenPermissionsCompat([group], { additionalConditions });

      expect(result).toHaveLength(1);
      expect(result[0].conditions).toStrictEqual({
        tenantId: '789',
        $and: [{ orgId: '123' }, { active: true }],
        $or: [{ role: 'admin' }, { role: 'manager' }],
      });
    });
  });

  describe('scope merging', () => {
    it('should merge group scope with permission scope', () => {
      const group: PermissionGroup<'user', 'read', 'can'> = {
        scope: 'tenant:123' as ScopeString,
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
            scope: 'org:456' as ScopeString,
          },
        ],
      };

      const result = flattenPermissionsCompat([group]);

      expect(result).toHaveLength(1);
      expect(result[0].scope).toBe('tenant:123:org:456');
    });

    it('should merge scope prefix when provided', () => {
      const group: PermissionGroup<'user', 'read', 'can'> = {
        scope: 'tenant:123' as ScopeString,
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
            scope: 'org:456' as ScopeString,
          },
        ],
      };

      const result = flattenPermissionsCompat([group], {
        scopePrefix: 'app:789',
      });

      expect(result).toHaveLength(1);
      expect(result[0].scope).toBe('app:789:tenant:123:org:456');
    });

    it('should handle undefined scope gracefully', () => {
      const group: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [{ subject: 'user', action: 'read', type: 'can' }],
      };

      const result = flattenPermissionsCompat([group]);

      expect(result).toHaveLength(1);
      expect(result[0].scope).toBeUndefined();
    });

    it('should handle scope prefix only', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
      };

      const result = flattenPermissionsCompat([permission], {
        scopePrefix: 'app:123',
      });

      expect(result).toHaveLength(1);
      expect(result[0].scope).toBe('app:123');
    });
  });

  describe('mixed input types', () => {
    it('should handle mixed array of strings, permissions, and groups', () => {
      const input: PermissionOrGroupOrString<
        'user' | 'org',
        'read' | 'create' | 'update',
        'can'
      >[] = [
        'user:read',
        { subject: 'org', action: 'create', type: 'can' },
        {
          permissions: [permission.user.update, { subject: 'org', action: 'read', type: 'can' }],
        },
      ];

      const result = flattenPermissionsCompat(input);

      expect(result).toHaveLength(4);
      expect(result[0]).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
      });
      expect(result[1]).toStrictEqual({
        subject: 'org',
        action: 'create',
        type: 'can',
      });
      expect(result[2]).toStrictEqual({
        subject: 'user',
        action: 'update',
        type: 'can',
      });
      expect(result[3]).toStrictEqual({
        subject: 'org',
        action: 'read',
        type: 'can',
      });
    });

    it('should handle complex nested structure with all types', () => {
      const input: PermissionOrGroupOrString<
        'user' | 'org',
        'read' | 'create' | 'update' | 'delete',
        'can'
      >[] = [
        'user:read',
        {
          conditions: { orgId: '123' },
          scope: 'tenant:456' as ScopeString,
          permissions: [
            { subject: 'org', action: 'create', type: 'can' },
            {
              permissions: [
                permission.user.update,
                { subject: 'org', action: 'delete', type: 'can' },
              ],
            },
          ],
        },
        // Add a regular permission (not in a group) to test modification
        { subject: 'user', action: 'delete', type: 'can' },
      ];

      const result = flattenPermissionsCompat(input, {
        additionalConditions: { tenantId: '789' },
        scopePrefix: 'org:000',
      });

      expect(result).toHaveLength(5);

      // First permission (string) - should be modified by options
      expect(result[0]).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: { tenantId: '789' },
        scope: 'org:000',
      });

      // Second permission (from group)
      expect(result[1]).toStrictEqual({
        subject: 'org',
        action: 'create',
        type: 'can',
        conditions: { tenantId: '789', orgId: '123' },
        scope: 'org:000:tenant:456',
      });

      // Third permission (from nested group)
      expect(result[2]).toStrictEqual({
        subject: 'user',
        action: 'update',
        type: 'can',
        conditions: { tenantId: '789', orgId: '123' },
        scope: 'org:000:tenant:456',
      });

      // Fourth permission (from nested group)
      expect(result[3]).toStrictEqual({
        subject: 'org',
        action: 'delete',
        type: 'can',
        conditions: { tenantId: '789', orgId: '123' },
        scope: 'org:000:tenant:456',
      });

      // Fifth permission (regular permission, not in a group) - should be modified by options
      expect(result[4]).toStrictEqual({
        subject: 'user',
        action: 'delete',
        type: 'can',
        conditions: { tenantId: '789' },
        scope: 'org:000',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty group permissions', () => {
      const group: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [],
      };

      const result = flattenPermissionsCompat([group]);
      expect(result).toStrictEqual([]);
    });

    it('should handle group with only nested empty groups', () => {
      const nestedGroup: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [],
      };

      const group: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [nestedGroup],
      };

      const result = flattenPermissionsCompat([group]);
      expect(result).toStrictEqual([]);
    });

    it('should handle undefined options gracefully', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
      };

      const result = flattenPermissionsCompat([permission]);
      expect(result).toStrictEqual([permission]);
    });

    it('should handle empty options object', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
      };

      const result = flattenPermissionsCompat([permission], {});
      expect(result).toStrictEqual([permission]);
    });
  });

  describe('type safety', () => {
    it('should maintain type safety for generic parameters', () => {
      const permissions: PermissionOrGroupOrString<'user', 'read' | 'create', 'can'>[] = [
        'user:read',
        { subject: 'user', action: 'create', type: 'can' },
      ];

      const result = flattenPermissionsCompat(permissions);

      // TypeScript should infer the correct types
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should work with different subject and action filters', () => {
      const permissions: PermissionOrGroupOrString<'org', 'manage', 'can'>[] = [
        'org:manage',
        { subject: 'org', action: 'manage', type: 'can' },
      ];

      const result = flattenPermissionsCompat(permissions);
      expect(result).toHaveLength(2);
    });

    it('should work with different action types', () => {
      const permissions: PermissionOrGroupOrString<'user', 'read', 'can' | 'cannot'>[] = [
        'user:read',
        { subject: 'user', action: 'read', type: 'cannot' },
      ];

      const result = flattenPermissionsCompat(permissions);
      expect(result).toHaveLength(2);
    });
  });
});
