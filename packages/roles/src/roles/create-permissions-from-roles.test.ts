import { describe, it, expect } from 'vitest';

import { isPermission, isPermissionGroup, Permission, PermissionGroup } from '../permissions';

import { createPermissionsFromRoles } from './create-permissions-from-roles';
import { Role } from './types';

describe('createPermissionsFromRoles', () => {
  const mockRole: Omit<Role, 'name'> = {
    permissions: [
      {
        subject: 'user',
        action: 'read',
        conditions: { userId: '123' },
      },
    ],
    scope: 'org:test-org',
  };

  const mockRoleWithUserScope: Omit<Role, 'name'> = {
    permissions: [
      {
        subject: 'app',
        action: 'manage',
        conditions: { appId: '456' },
      },
    ],
    userScope: 'app:test-app',
  };

  const mockRoleWithGlobalScope: Omit<Role, 'name'> = {
    permissions: [
      {
        subject: 'role',
        action: 'read',
      },
    ],
    scope: 'system',
  };

  const mockRoleWithMultiplePermissions: Omit<Role, 'name'> = {
    permissions: [
      {
        subject: 'user',
        action: ['read', 'create'],
        conditions: { orgId: '789' },
      },
      {
        subject: 'app',
        action: 'read',
        conditions: { appId: '101' },
      },
    ],
    scope: 'org:test-org:app:test-app',
  };

  const mockRoleWithNestedPermissions: Omit<Role, 'name'> = {
    permissions: [
      {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            conditions: { userId: 'nested-123' },
          },
        ],
        conditions: { orgId: 'nested-org' },
      },
    ],
    scope: 'org:nested-org',
  };

  // New test case for simple permissions without scope or conditions
  const mockSimpleRole: Omit<Role, 'name'> = {
    permissions: [
      {
        subject: 'user',
        action: 'read',
      },
      {
        subject: 'app',
        action: 'create',
      },
    ],
  };

  describe('basic functionality', () => {
    it('should create permissions from a single role with scope', () => {
      const result = createPermissionsFromRoles([mockRole]);

      expect(result).toHaveLength(1); // 1 group + 1 scope permission
      const group = result.find(isPermissionGroup);
      expect(group?.permissions).toHaveLength(2); // 1 from permissions

      // Check the permission from role.permissions
      const rolePermission = group?.permissions[1] as Permission;
      expect(rolePermission).toBeDefined();
      expect(rolePermission.action).toBe('read');
      expect(rolePermission.conditions).toStrictEqual({ userId: '123' });

      // Check the permission from scope
      const scopePermission = group?.permissions[0] as Permission;
      expect(scopePermission).toBeDefined();
      expect(scopePermission.action).toBe('read');
      expect(scopePermission.conditions).toStrictEqual({ orgId: 'test-org' });
    });

    it('should create permissions from a single role with userScope', () => {
      const result = createPermissionsFromRoles([mockRoleWithUserScope]);

      expect(result).toHaveLength(1);
      const group = result.find((p) => 'permissions' in p);
      expect(group).toBeDefined();
      expect(group?.permissions).toHaveLength(2); // 1 from permissions + 1 from scope

      console.log(JSON.stringify(result, null, 2));

      // Check the permission from role.permissions
      const rolePermission = group?.permissions[1] as Permission;
      expect(rolePermission).toBeDefined();
      expect(rolePermission.action).toBe('manage');
      expect(rolePermission.conditions).toStrictEqual({ appId: '456' });

      // Check the permission from userScope
      const scopePermission = group?.permissions[0] as Permission;
      expect(scopePermission).toBeDefined();
      expect(scopePermission.action).toBe('read');
      expect(scopePermission.conditions).toStrictEqual({ appId: 'test-app' });
    });

    it('should prioritize userScope over scope when both are present', () => {
      const roleWithBoth: Omit<Role, 'name'> = {
        ...mockRole,
        userScope: 'app:test-app',
      };

      const result = createPermissionsFromRoles([roleWithBoth]);

      expect(result).toHaveLength(1);
      const group = result.find((p) => 'permissions' in p);
      expect(group).toBeDefined();
      expect(group?.permissions).toHaveLength(2);

      // Should use userScope, not scope
      const scopePermission = group?.permissions.find(
        (p) => 'subject' in p && p.subject === 'app',
      ) as Permission;
      expect(scopePermission).toBeDefined();
      expect(scopePermission.conditions).toStrictEqual({ appId: 'test-app' });
    });

    it('should return array of Permissions when group is only one level with no scope or conditions', () => {
      const result = createPermissionsFromRoles([mockSimpleRole]);

      // Should return Permission[] directly, not PermissionGroup[]
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      // Check that each item is a Permission (not a PermissionGroup)
      result.forEach((item) => {
        expect('subject' in item).toBe(true);
        expect('action' in item).toBe(true);
        expect('permissions' in item).toBe(false); // Should not be a PermissionGroup
      });

      // Check specific permissions
      const userPermission = result.find(
        (p) => 'subject' in p && p.subject === 'user',
      ) as Permission;
      expect(userPermission).toBeDefined();
      expect(userPermission.action).toBe('read');
      expect(userPermission.conditions).toBeUndefined();

      const appPermission = result.find((p) => 'subject' in p && p.subject === 'app') as Permission;
      expect(appPermission).toBeDefined();
      expect(appPermission.action).toBe('create');
      expect(appPermission.conditions).toBeUndefined();
    });
  });

  describe('multiple roles', () => {
    it('should combine permissions from multiple roles', () => {
      const result = createPermissionsFromRoles([
        mockRole,
        mockRoleWithUserScope,
      ]) as PermissionGroup[];

      expect(result).toHaveLength(2);
      const group1 = result.find((p) => 'permissions' in p && p.scope === 'org:test-org');
      const group2 = result.find((p) => 'permissions' in p && p.scope === 'app:test-app');
      expect(group1?.permissions).toHaveLength(2); // 1 from each role
      expect(group2?.permissions).toHaveLength(2); // 1 from each role

      // Check permissions from first role
      const userPermission = group1?.permissions.find(
        (p) => 'subject' in p && p.subject === 'user',
      ) as Permission;
      expect(userPermission).toBeDefined();
      expect(userPermission.action).toBe('read');

      // Check permissions from second role
      const appPermission = group2?.permissions.find(
        (p) => 'subject' in p && p.subject === 'app' && p.action === 'manage',
      ) as Permission;
      expect(appPermission).toBeDefined();
      expect(appPermission.action).toBe('manage');
    });

    it('should handle roles with different scope types', () => {
      const result = createPermissionsFromRoles([
        mockRole, // org:test-org
        mockRoleWithGlobalScope, // system
      ]) as PermissionGroup[];

      expect(result).toHaveLength(2);
      const group1 = result.find((p) => 'permissions' in p && p.scope === 'org:test-org');
      const group2 = result.find((p) => 'permissions' in p && p.scope === 'system');
      expect(group1?.permissions).toHaveLength(2); // 2 from first role
      expect(group2?.permissions).toHaveLength(2); // 1 from second role

      // Check system scope permission
      const systemPermission = result[1]?.permissions.find(
        // @ts-expect-error typings fail for this check
        (p) => 'subject' in p && p.subject === 'system',
      ) as Permission;
      expect(systemPermission).toBeDefined();
      expect(systemPermission.action).toBe('read');
      expect(systemPermission.conditions).toBeUndefined();
    });

    it('should return array of Permissions when combining simple roles without scope or conditions', () => {
      const simpleRole1: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
          },
        ],
      };

      const simpleRole2: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'app',
            action: 'create',
          },
        ],
      };

      const result = createPermissionsFromRoles([simpleRole1, simpleRole2]);

      // Should return Permission[] directly, not PermissionGroup[]
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);

      // Check that each item is a Permission
      result.forEach((item) => {
        expect('subject' in item).toBe(true);
        expect('action' in item).toBe(true);
        expect('permissions' in item).toBe(false);
      });

      const userPermission = result.find(
        (p) => 'subject' in p && p.subject === 'user',
      ) as Permission;
      expect(userPermission).toBeDefined();
      expect(userPermission.action).toBe('read');

      const appPermission = result.find((p) => 'subject' in p && p.subject === 'app') as Permission;
      expect(appPermission).toBeDefined();
      expect(appPermission.action).toBe('create');
    });
  });

  describe('scope parsing', () => {
    it('should handle empty scope', () => {
      const roleWithEmptyScope: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
          },
        ],
        scope: '',
      };

      const result = createPermissionsFromRoles([roleWithEmptyScope]);

      expect(result).toHaveLength(1);
      const group = result.find((p) => 'permissions' in p);
      expect(group).toBeUndefined(); // Only the permission, no scope permission
      const permission = result.find((p) => 'subject' in p && p.subject === 'user') as Permission;
      expect(permission).toBeDefined();
      expect(permission.action).toBe('read');
      expect(permission.conditions).toBeUndefined();
    });

    it('should handle undefined scope', () => {
      const roleWithUndefinedScope: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
          },
        ],
      };

      const result = createPermissionsFromRoles([roleWithUndefinedScope]);

      expect(result).toHaveLength(1);
      const group = result.find((p) => 'permissions' in p);
      expect(group).toBeUndefined(); // Only the permission, no scope permission
      const permission = result.find((p) => 'subject' in p && p.subject === 'user') as Permission;
      expect(permission).toBeDefined();
      expect(permission.action).toBe('read');
      expect(permission.conditions).toBeUndefined();
    });

    it('should handle complex scope with multiple segments', () => {
      const roleWithComplexScope: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
          },
        ],
        scope: 'org:test-org:app:test-app:feature:test-feature',
      };

      const result = createPermissionsFromRoles([roleWithComplexScope]) as PermissionGroup[];

      expect(result).toHaveLength(3); // 1 group + 3 scope permissions
      const group = result.find((p) => 'permissions' in p);
      expect(group).toBeDefined();
      expect(group?.permissions).toHaveLength(1); // 1 permission

      // Check org scope permission
      const orgPermission = result[0]?.permissions.find(
        (p) => 'subject' in p && p.subject === 'org',
      ) as Permission;
      expect(orgPermission).toBeDefined();
      expect(orgPermission.conditions).toStrictEqual({ orgId: 'test-org' });

      // Check app scope permission
      const appPermission = result[1]?.permissions.find(
        (p) => 'subject' in p && p.subject === 'app',
      ) as Permission;
      expect(appPermission).toBeDefined();
      expect(appPermission.conditions).toStrictEqual({ appId: 'test-app' });

      // Check feature scope permission
      const featurePermission = result[2]?.permissions.find(
        // @ts-expect-error typings fail for this check
        (p) => 'subject' in p && p.subject === 'feature',
      ) as Permission;
      expect(featurePermission).toBeDefined();
      expect(featurePermission.conditions).toStrictEqual({
        featureId: 'test-feature',
      });
    });

    it('should handle scope with missing ID', () => {
      const roleWithMissingId: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
          },
        ],
        scope: 'org:test-org:app', // Missing app ID
      };

      const result = createPermissionsFromRoles([roleWithMissingId]) as PermissionGroup[];

      expect(result).toHaveLength(2);
      const group = result.find((p) => 'permissions' in p);
      expect(group).toBeDefined();
      expect(group?.permissions).toHaveLength(1); // 1 permission

      // Should only create permission for org, not for app without ID
      const orgPermission = result[0]?.permissions.find(
        (p) => 'subject' in p && p.subject === 'org',
      ) as Permission;
      expect(orgPermission).toBeDefined();
      expect(orgPermission.action).toBe('read');
      expect(orgPermission.conditions).toStrictEqual({ orgId: 'test-org' });

      const appPermission = result[1]?.permissions.find(
        (p) => 'subject' in p && p.subject === 'app' && p.action === 'read',
      ) as Permission;
      expect(appPermission).toBeDefined();
      expect(appPermission.action).toBe('read');
      expect(appPermission.conditions).toBeUndefined();
    });
  });

  describe('permission handling', () => {
    it('should handle roles with multiple permissions', () => {
      const result: PermissionGroup[] = createPermissionsFromRoles([
        mockRoleWithMultiplePermissions,
      ]) as PermissionGroup[];

      expect(result).toHaveLength(2); // 1 group + 2 scope permissions
      const group = result.find((p) => 'permissions' in p);
      expect(group).toBeDefined();
      expect(group?.permissions).toHaveLength(1); // 2 permissions

      // Check user permissions
      const userPermission = result[1]?.permissions.find(
        (p) => 'subject' in p && p.subject === 'user' && Array.isArray(p.action),
      ) as Permission;
      expect(userPermission).toBeDefined();
      expect(userPermission.action).toStrictEqual(['read', 'create']);
      expect(userPermission.conditions).toStrictEqual({ orgId: '789' });

      // Check app permission
      const appPermission = result[1]?.permissions.find(
        (p) => 'subject' in p && p.subject === 'app' && p.action === 'read',
      ) as Permission;
      expect(appPermission).toBeDefined();
      expect(appPermission.conditions).toStrictEqual({ appId: 'test-app' });
    });

    it('should handle nested permission groups', () => {
      const result = createPermissionsFromRoles([mockRoleWithNestedPermissions]);

      const group = result.find((p) => 'permissions' in p);
      expect(group).toBeDefined();

      expect(result).toHaveLength(1);
      expect(group?.permissions).toHaveLength(2); // 1 nested permission + 1 scope permission
      const scopePermission = group?.permissions.find(
        (p) => 'subject' in p && p.subject === 'org',
      ) as Permission;
      expect(scopePermission).toBeDefined();
      expect(scopePermission.action).toBe('read');
      expect(scopePermission.conditions).toStrictEqual({ orgId: 'nested-org' });

      // Check nested permission
      const nestedPermission = group?.permissions.find(
        (p) => 'subject' in p && p.subject === 'user',
      ) as Permission;
      expect(nestedPermission).toBeDefined();
      expect(nestedPermission.action).toBe('read');
      expect(nestedPermission.conditions).toStrictEqual({
        userId: 'nested-123',
        orgId: 'nested-org',
      });
    });

    it('should handle empty permissions array', () => {
      const roleWithEmptyPermissions: Omit<Role, 'name'> = {
        permissions: [],
        scope: 'org:test-org',
      };

      const result = createPermissionsFromRoles([roleWithEmptyPermissions]) as PermissionGroup[];

      expect(result).toHaveLength(1);

      const group = result.find(isPermission);
      const scopePermission = result[0].permissions.find(
        (p) => 'subject' in p && p.subject === 'org',
      ) as Permission;

      expect(group).toBeUndefined(); // Only scope permission
      expect(scopePermission).toBeDefined();
      expect(scopePermission.action).toBe('read');
      expect(scopePermission.conditions).toStrictEqual({ orgId: 'test-org' });
    });
  });

  describe('options handling', () => {
    it('should pass options to flattenGroupPermissions', () => {
      const roleWithConditions: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            conditions: { userId: '123' },
          },
        ],
        scope: 'org:test-org',
      };

      const options = {
        ignoreConditions: true,
        ignoreScope: false,
      };

      const result = createPermissionsFromRoles([roleWithConditions], options);

      expect(result).toHaveLength(4); // 1 group + 1 scope permission
      // The options should affect how permissions are processed
      const group = result.find(isPermissionGroup);
      expect(group).toBeDefined();
      const scopePermission = group?.permissions.find(
        (p) => 'subject' in p && p.subject === 'org',
      ) as Permission;
      expect(group?.permissions).toHaveLength(1);
      expect(scopePermission.action).toBe('read');
      expect(scopePermission.conditions).toStrictEqual({ orgId: 'test-org' });
    });

    it('should use ignoreConditions: true for groupPermissions', () => {
      const role1: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            conditions: { userId: '123' },
          },
        ],
        scope: 'org:test-org',
      };

      const role2: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            conditions: { userId: '456' }, // Different conditions
          },
        ],
        scope: 'org:test-org',
      };

      const result = createPermissionsFromRoles([role1, role2]);

      // Should group permissions together despite different conditions due to ignoreConditions: true
      expect(result).toHaveLength(1); // 1 group + 1 scope permission
      const group = result.find((p) => 'permissions' in p);
      expect(group).toBeDefined();
      const scopePermission = group?.permissions.find(
        (p) => 'subject' in p && p.subject === 'org',
      ) as Permission;
      expect(group?.permissions).toHaveLength(3); // 2 permissions
      expect(scopePermission.action).toBe('read');
      expect(scopePermission.conditions).toStrictEqual({ orgId: 'test-org' });
    });
  });

  describe('edge cases', () => {
    it('should handle empty roles array', () => {
      const result = createPermissionsFromRoles([]);

      expect(result).toHaveLength(0);
    });

    it('should handle role with only scope and no permissions', () => {
      const roleWithOnlyScope: Omit<Role, 'name'> = {
        permissions: [],
        scope: 'org:test-org',
      };

      const result = createPermissionsFromRoles([roleWithOnlyScope]) as PermissionGroup[];
      const permission = result[0].permissions[0] as Permission;

      expect(result).toHaveLength(1);
      expect(permission.action).toBe('read'); // Only scope permission
      expect(permission.conditions).toStrictEqual({ orgId: 'test-org' });
      expect(permission.subject).toBe('org');
    });

    it('should handle role with only userScope and no permissions', () => {
      const roleWithOnlyUserScope: Omit<Role, 'name'> = {
        permissions: [],
        userScope: 'app:test-app',
      };

      const result = createPermissionsFromRoles([roleWithOnlyUserScope]);

      const group = result.find(isPermissionGroup);
      expect(group).toBeDefined();
      const permission = group?.permissions.find(
        (p) => 'subject' in p && p.subject === 'app',
      ) as Permission;

      expect(result).toHaveLength(1);
      expect(permission.action).toBe('read'); // Only scope permission
      expect(permission.conditions).toStrictEqual({ appId: 'test-app' });
      expect(permission.subject).toBe('app');
    });

    it('should handle scope with single segment (no ID)', () => {
      const roleWithSingleScope: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
          },
        ],
        scope: 'system', // Single segment, no ID
      };

      const result = createPermissionsFromRoles([roleWithSingleScope]);

      const group = result.find((p) => 'permissions' in p);
      expect(group).toBeDefined();

      expect(result).toHaveLength(1);
      expect(group?.permissions).toHaveLength(2); // Only the permission, no scope permission

      // Should not create scope permission for single segment without ID
      const systemPermission = group?.permissions.find(
        // @ts-expect-error typings fail for this check
        (p) => 'subject' in p && p.subject === 'system',
      ) as Permission;
      expect(systemPermission).toBeDefined();
      expect(systemPermission.action).toBe('read');
      expect(systemPermission.conditions).toBeUndefined();
    });

    it('should return Permission[] for single role with simple permissions and no scope', () => {
      const simpleRole: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
          },
        ],
      };

      const result = createPermissionsFromRoles([simpleRole]);

      // Should return Permission[] directly
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect('subject' in result[0]).toBe(true);
      expect('action' in result[0]).toBe(true);
      expect('permissions' in result[0]).toBe(false);

      const permission = result[0] as Permission;
      expect(permission.subject).toBe('user');
      expect(permission.action).toBe('read');
      expect(permission.conditions).toBeUndefined();
    });

    it('should return Permission[] when the permissionGroup does not have scope or conditiosn but the permissions have conditions', () => {
      const roleWithConditions: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            conditions: { userId: '123' },
          },
        ],
      };

      const result = createPermissionsFromRoles([roleWithConditions]);

      // Should return PermissionGroup[] because of conditions
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect('permissions' in result[0]).toBe(false);

      const permission = result[0] as Permission;
      expect(permission.subject).toBe('user');
      expect(permission.action).toBe('read');
      expect(permission.conditions).toStrictEqual({ userId: '123' });
    });

    it('should return PermissionGroup[] when permissions have scope even without conditions', () => {
      const roleWithScope: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
          },
        ],
        scope: 'org:test-org',
      };

      const result = createPermissionsFromRoles([roleWithScope]);

      // Should return PermissionGroup[] because of scope
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1); // 1 permission + 1 scope permission
      const group = result.find((p) => 'permissions' in p);
      expect(group !== undefined && 'permissions' in group).toBe(true);
      expect(group?.permissions).toHaveLength(2); // 1 permission
    });

    it('should return Permission[] for multiple simple roles without scope or conditions', () => {
      const simpleRole1: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
          },
        ],
      };

      const simpleRole2: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'app',
            action: 'create',
          },
        ],
      };

      const simpleRole3: Omit<Role, 'name'> = {
        permissions: [
          {
            subject: 'role',
            action: 'manage',
          },
        ],
      };

      const result = createPermissionsFromRoles([simpleRole1, simpleRole2, simpleRole3]);

      // Should return Permission[] directly
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);

      result.forEach((item) => {
        expect('subject' in item).toBe(true);
        expect('action' in item).toBe(true);
        expect('permissions' in item).toBe(false);
      });

      const userPermission = result.find(
        (p) => 'subject' in p && p.subject === 'user',
      ) as Permission;
      const appPermission = result.find((p) => 'subject' in p && p.subject === 'app') as Permission;
      const rolePermission = result.find(
        (p) => 'subject' in p && p.subject === 'role',
      ) as Permission;

      expect(userPermission.action).toBe('read');
      expect(appPermission.action).toBe('create');
      expect(rolePermission.action).toBe('manage');
    });
  });
});
