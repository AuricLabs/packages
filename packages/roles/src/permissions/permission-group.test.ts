import { ScopeString } from '../scope';

import { cannot } from './can-cannot-proxy';
import { permissionGroup } from './permission-group';
import { permission } from './permission-proxy';
import { PermissionGroup, PermissionOrGroup, ConditionsQuery } from './types';

describe('permissionGroup', () => {
  describe('function overloads', () => {
    describe('overload 1: PermissionGroup input', () => {
      it('should return the input PermissionGroup unchanged', () => {
        const inputGroup = permissionGroup({
          permissions: [permission.user.read, permission.user.create],
          conditions: { orgId: '123' },
          scope: 'org:123' as ScopeString,
        });

        const result = permissionGroup(inputGroup);

        expect(result).toBe(inputGroup);
        expect(result).toStrictEqual({
          permissions: [permission.user.read, permission.user.create],
          conditions: { orgId: '123' },
          scope: 'org:123',
        });
      });

      it('should handle PermissionGroup with nested PermissionGroups', () => {
        const nestedGroup = permissionGroup({
          permissions: [
            permission.user.read,
            {
              permissions: [permission.user.create],
              conditions: { userId: '456' },
              scope: 'app:789' as ScopeString,
            },
          ],
          conditions: { orgId: '123' },
          scope: 'org:123' as ScopeString,
        });

        const result = permissionGroup(nestedGroup);

        expect(result).toBe(nestedGroup);
        expect(result.permissions).toHaveLength(2);
        expect(result.permissions[1]).toHaveProperty('permissions');
      });
    });

    describe('overload 2: Array of AnyPermissionOrGroup with optional conditions and scope', () => {
      it('should create PermissionGroup from array of permissions', () => {
        const permissions: PermissionOrGroup<'user', 'read' | 'create', 'can'>[] = [
          permission.user.read,
          permission.user.create,
        ];

        const result = permissionGroup(permissions);

        expect(result).toStrictEqual({
          permissions,
          conditions: undefined,
          scope: undefined,
        });
      });

      it('should create PermissionGroup with conditions', () => {
        const permissions: PermissionOrGroup<'user', 'read' | 'create', 'can'>[] = [
          permission.user.read,
          permission.user.create,
        ];
        const conditions: ConditionsQuery<{ orgId: string }> = { orgId: '123' };

        const result = permissionGroup(permissions, conditions);

        expect(result).toStrictEqual({
          permissions,
          conditions,
          scope: undefined,
        });
      });

      it('should create PermissionGroup with scope', () => {
        const permissions: PermissionOrGroup<'user', 'read' | 'create', 'can'>[] = [
          permission.user.read,
          permission.user.create,
        ];
        const scope: ScopeString = 'org:123';

        const result = permissionGroup(permissions, undefined, scope);

        expect(result).toStrictEqual({
          permissions,
          conditions: undefined,
          scope,
        });
      });

      it('should create PermissionGroup with both conditions and scope', () => {
        const permissions: PermissionOrGroup<'user', 'read' | 'create', 'can'>[] = [
          permission.user.read,
          permission.user.create,
        ];
        const conditions: ConditionsQuery<{ orgId: string }> = { orgId: '123' };
        const scope: ScopeString = 'org:123';

        const result = permissionGroup(permissions, conditions, scope);

        expect(result).toStrictEqual({
          permissions,
          conditions,
          scope,
        });
      });

      it('should handle mixed array of permissions and permission groups', () => {
        const permissions: PermissionOrGroup<'user', 'read' | 'create', 'can'>[] = [
          permission.user.read,
          permissionGroup([permission.user.create], {
            userId: '456',
          }),
        ];

        const result = permissionGroup(permissions);

        expect(result).toStrictEqual({
          permissions,
          conditions: undefined,
          scope: undefined,
        });
        expect(result.permissions).toHaveLength(2);
        expect(result.permissions[1]).toHaveProperty('permissions');
      });
    });

    describe('overload 3: Union type input', () => {
      it('should handle array input (calls overload 2)', () => {
        const permissions: PermissionOrGroup<'user', 'read' | 'create', 'can'>[] = [
          permission.user.read,
          permission.user.create,
        ];

        const result = permissionGroup(permissions);

        expect(result).toStrictEqual({
          permissions,
          conditions: undefined,
          scope: undefined,
        });
      });

      it('should handle PermissionGroup input (calls overload 1)', () => {
        const inputGroup: PermissionGroup<'user', 'read' | 'create', 'can'> = {
          permissions: [permission.user.read, permission.user.create],
        };

        const result = permissionGroup(inputGroup);

        expect(result).toBe(inputGroup);
      });
    });
  });

  describe('implementation logic', () => {
    it('should detect array input and create new PermissionGroup', () => {
      const permissions = [permission.user.read, permission.user.create];

      const result = permissionGroup(permissions);

      expect(result).toStrictEqual({
        permissions,
        conditions: undefined,
        scope: undefined,
      });
      expect(result).not.toBe(permissions); // Should be a new object
    });

    it('should detect PermissionGroup input and return it unchanged', () => {
      const inputGroup = permissionGroup({
        permissions: [permission.user.read, permission.user.create],
      });

      const result = permissionGroup(inputGroup);

      expect(result).toBe(inputGroup); // Should be the same reference
    });
  });

  describe('type safety', () => {
    it('should maintain generic type constraints', () => {
      // Test with specific subject and action types
      const userPermissions: PermissionOrGroup<'user', 'read' | 'create', 'can'>[] = [
        permission.user.read,
        permission.user.create,
      ];

      const result = permissionGroup(userPermissions);

      // TypeScript should enforce that result.permissions only contains user permissions
      expect(result.permissions).toHaveLength(2);
      expect(result.permissions[0]).toHaveProperty('subject', 'user');
      expect(result.permissions[1]).toHaveProperty('subject', 'user');
    });

    it('should work with different subject types', () => {
      const orgPermissions: PermissionOrGroup<'org', 'manage' | 'read', 'can'>[] = [
        permission.org.manage,
        permission.org.read,
      ];

      const result = permissionGroup(orgPermissions);

      expect(result.permissions).toHaveLength(2);
      expect(result.permissions[0]).toHaveProperty('subject', 'org');
      expect(result.permissions[1]).toHaveProperty('subject', 'org');
    });

    it('should work with different action types', () => {
      const appPermissions: PermissionOrGroup<'app', 'assign' | 'unassign', 'can'>[] = [
        permission.app.assign,
        permission.app.unassign,
      ];

      const result = permissionGroup(appPermissions);

      expect(result.permissions).toHaveLength(2);
      expect(result.permissions[0]).toHaveProperty('action', 'assign');
      expect(result.permissions[1]).toHaveProperty('action', 'unassign');
    });

    it('should work with different action types (cannot)', () => {
      const cannotPermissions: PermissionOrGroup<'user', 'delete', 'cannot'>[] = [
        cannot.delete.user,
      ];

      const result = permissionGroup(cannotPermissions);

      expect(result.permissions).toHaveLength(1);
      expect(result.permissions[0]).toHaveProperty('type', 'cannot');
    });
  });

  describe('edge cases', () => {
    it('should handle empty array input', () => {
      const result = permissionGroup([]);

      expect(result).toStrictEqual({
        permissions: [],
        conditions: undefined,
        scope: undefined,
      });
    });

    it('should handle single permission in array', () => {
      const permissions = [permission.user.read];

      const result = permissionGroup(permissions);

      expect(result).toStrictEqual({
        permissions,
        conditions: undefined,
        scope: undefined,
      });
    });

    it('should handle undefined conditions', () => {
      const permissions = [permission.user.read];

      const result = permissionGroup(permissions, undefined);

      expect(result).toStrictEqual({
        permissions,
        conditions: undefined,
        scope: undefined,
      });
    });

    it('should handle undefined scope', () => {
      const permissions = [permission.user.read];
      const conditions = { orgId: '123' };

      const result = permissionGroup(permissions, conditions, undefined);

      expect(result).toStrictEqual({
        permissions,
        conditions,
        scope: undefined,
      });
    });

    it('should handle complex conditions object', () => {
      const permissions = [permission.user.read];
      const conditions: ConditionsQuery<{ orgId: string; userId: string }> = {
        // @ts-expect-error - this is a test
        $and: [{ orgId: '123' }, { userId: '456' }],
      };

      const result = permissionGroup(permissions, conditions);

      expect(result).toStrictEqual({
        permissions,
        conditions,
        scope: undefined,
      });
    });

    it('should handle various scope string formats', () => {
      const permissions = [permission.user.read];
      const scopes: ScopeString[] = ['', 'system', 'org:123', 'app:456', 'org:123:app:456'];

      scopes.forEach((scope) => {
        const result = permissionGroup(permissions, undefined, scope);

        expect(result).toStrictEqual({
          permissions,
          conditions: undefined,
          scope,
        });
      });
    });
  });

  describe('integration with permission proxy', () => {
    it('should work with permissions created via permission proxy', () => {
      const permissions = [permission.user.read, permission.user.create];

      const result = permissionGroup(permissions);

      expect(result).toStrictEqual({
        permissions,
        conditions: undefined,
        scope: undefined,
      });
    });

    it('should work with permission proxy and conditions/scope', () => {
      const permissions = [
        permission('user', 'read', 'can', { orgId: '123' }, 'org:123'),
        permission('user', 'create', 'can', { orgId: '123' }, 'org:123'),
      ];

      const result = permissionGroup(permissions);

      expect(result).toStrictEqual({
        permissions,
        conditions: undefined,
        scope: undefined,
      });
    });
  });

  describe('real-world usage scenarios', () => {
    it('should handle user management permissions', () => {
      const userPermissions: PermissionOrGroup<
        'user',
        'read' | 'create' | 'update' | 'delete',
        'can'
      >[] = [
        permission('user', 'read', 'can'),
        permission('user', 'create', 'can'),
        permission('user', 'update', 'can'),
        permission('user', 'delete', 'can'),
      ];

      const result = permissionGroup(userPermissions, { orgId: '123' }, 'org:123');

      expect(result).toStrictEqual({
        permissions: userPermissions,
        conditions: { orgId: '123' },
        scope: 'org:123',
      });
    });

    it('should handle role-based access control', () => {
      const rolePermissions: PermissionOrGroup<'role', 'assign' | 'unassign', 'can'>[] = [
        permission('role', 'assign', 'can'),
        permission('role', 'unassign', 'can'),
      ];

      const result = permissionGroup(rolePermissions, { userId: '456' }, 'app:789');

      expect(result).toStrictEqual({
        permissions: rolePermissions,
        conditions: { userId: '456' },
        scope: 'app:789',
      });
    });

    it('should handle system-wide permissions', () => {
      const systemPermissions: PermissionOrGroup<'all', 'manage', 'can'>[] = [
        permission('all', 'manage', 'can'),
      ];

      const result = permissionGroup(systemPermissions, undefined, 'system');

      expect(result).toStrictEqual({
        permissions: systemPermissions,
        conditions: undefined,
        scope: 'system',
      });
    });
  });
});
