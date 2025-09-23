import { Permission } from '../permissions';

import { mergeRoles } from './merge-roles';
import { Role } from './types';

describe('mergeRoles', () => {
  const baseRole: Role = {
    name: 'base-role',
    permissions: [
      {
        subject: 'user',
        action: 'read',
        conditions: { userId: '123' },
      },
    ],
    scope: 'org:test-org',
    userScope: 'app:test-app',
    isGlobal: false,
  };

  const roleToMerge: Partial<Role> = {
    permissions: [
      {
        subject: 'app',
        action: 'manage',
        conditions: { appId: '456' },
      },
    ],
    scope: 'org:merged-org',
    userScope: 'app:merged-app',
    isGlobal: true,
  };

  const roleWithMultiplePermissions: Partial<Role> = {
    permissions: [
      {
        subject: 'role',
        action: ['read', 'create'],
        conditions: { orgId: '789' },
      },
      {
        subject: 'org',
        action: 'read',
        conditions: { orgId: '101' },
      },
    ],
  };

  const roleWithNestedPermissions: Partial<Role> = {
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
  };

  describe('basic functionality', () => {
    it('should merge a single role with partial role data', () => {
      const result = mergeRoles(baseRole, roleToMerge);

      expect(result.name).toBe('base-role');
      expect(result.permissions).toHaveLength(2);
      expect(result.scope).toBe('org:merged-org');
      expect(result.userScope).toBe('app:merged-app');
      expect(result.isGlobal).toBe(true);

      // Check base role permissions are preserved
      const basePermission = result.permissions.find(
        (p) => 'subject' in p && p.subject === 'user',
      ) as Permission;
      expect(basePermission).toBeDefined();
      expect(basePermission.action).toBe('read');
      expect(basePermission.conditions).toStrictEqual({ userId: '123' });

      // Check merged role permissions are added
      const mergedPermission = result.permissions.find(
        (p) => 'subject' in p && p.subject === 'app',
      ) as Permission;
      expect(mergedPermission).toBeDefined();
      expect(mergedPermission.action).toBe('manage');
      expect(mergedPermission.conditions).toStrictEqual({ appId: '456' });
    });

    it('should merge multiple partial roles', () => {
      const result = mergeRoles(baseRole, roleToMerge, roleWithMultiplePermissions, undefined);

      expect(result.name).toBe('base-role');
      expect(result.permissions).toHaveLength(4); // 1 + 1 + 2
      expect(result.scope).toBe('org:merged-org');
      expect(result.userScope).toBe('app:merged-app');
      expect(result.isGlobal).toBe(true);

      // Check all permissions are present
      const subjects = result.permissions.filter((p) => 'subject' in p).map((p) => p.subject);
      expect(subjects).toContain('user');
      expect(subjects).toContain('app');
      expect(subjects).toContain('role');
      expect(subjects).toContain('org');
    });

    it('should merge roles with undefined roles', () => {
      const result = mergeRoles(
        baseRole,
        undefined,
        roleToMerge,
        roleWithMultiplePermissions,
        undefined,
      );

      expect(result.name).toBe('base-role');
      expect(result.permissions).toHaveLength(4); // 1 + 1 + 2
      expect(result.scope).toBe('org:merged-org');
      expect(result.userScope).toBe('app:merged-app');
      expect(result.isGlobal).toBe(true);

      // Check all permissions are present
      const subjects = result.permissions.filter((p) => 'subject' in p).map((p) => p.subject);
      expect(subjects).toContain('user');
      expect(subjects).toContain('app');
      expect(subjects).toContain('role');
      expect(subjects).toContain('org');
    });
  });

  describe('permission merging', () => {
    it('should concatenate permissions arrays', () => {
      const result = mergeRoles(baseRole, roleWithMultiplePermissions);

      expect(result.permissions).toHaveLength(3); // 1 + 2

      // Base role permission
      const userPermission = result.permissions.find(
        (p) => 'subject' in p && p.subject === 'user',
      ) as Permission;
      expect(userPermission).toBeDefined();

      // Merged role permissions
      const rolePermission = result.permissions.find(
        (p) => 'subject' in p && p.subject === 'role',
      ) as Permission;
      expect(rolePermission).toBeDefined();
      expect(rolePermission.action).toStrictEqual(['read', 'create']);

      const orgPermission = result.permissions.find(
        (p) => 'subject' in p && p.subject === 'org',
      ) as Permission;
      expect(orgPermission).toBeDefined();
    });

    it('should handle nested permission groups', () => {
      const result = mergeRoles(baseRole, roleWithNestedPermissions);

      expect(result.permissions).toHaveLength(2); // 1 + 1 (nested group)

      // Check nested permission group is preserved
      const nestedGroup = result.permissions.find((p) => 'permissions' in p);
      expect(nestedGroup).toBeDefined();
      expect(nestedGroup?.permissions).toHaveLength(1);

      const nestedPermission = nestedGroup?.permissions[0] as Permission;
      expect(nestedPermission.subject).toBe('user');
      expect(nestedPermission.action).toBe('read');
    });

    it('should handle empty permissions arrays', () => {
      const roleWithEmptyPermissions: Partial<Role> = {
        permissions: [],
      };

      const result = mergeRoles(baseRole, roleWithEmptyPermissions);

      expect(result.permissions).toHaveLength(1); // Only base role permissions
      expect(result.permissions[0]).toStrictEqual(baseRole.permissions[0]);
    });

    it('should handle undefined permissions', () => {
      const roleWithUndefinedPermissions: Partial<Role> = {
        scope: 'org:undefined-permissions',
      };

      const result = mergeRoles(baseRole, roleWithUndefinedPermissions);

      expect(result.permissions).toHaveLength(1); // Only base role permissions
      expect(result.permissions[0]).toStrictEqual(baseRole.permissions[0]);
    });
  });

  describe('property merging', () => {
    it('should override properties from later roles', () => {
      const role1: Partial<Role> = { scope: 'org:first' };
      const role2: Partial<Role> = { scope: 'org:second' };
      const role3: Partial<Role> = { scope: 'org:third' };

      const result = mergeRoles(baseRole, role1, role2, role3);

      expect(result.scope).toBe('org:third');
    });

    it('should preserve base role properties when not overridden', () => {
      const partialRole: Partial<Role> = {
        permissions: [
          {
            subject: 'app',
            action: 'read',
          },
        ],
      };

      const result = mergeRoles(baseRole, partialRole);

      expect(result.name).toBe('base-role');
      expect(result.userScope).toBe('app:test-app');
      expect(result.isGlobal).toBe(false);
    });

    it('should handle boolean properties correctly', () => {
      const roleWithFalse: Partial<Role> = { isGlobal: false };
      const roleWithTrue: Partial<Role> = { isGlobal: true };

      const result1 = mergeRoles(baseRole, roleWithFalse);
      expect(result1.isGlobal).toBe(false);

      const result2 = mergeRoles(baseRole, roleWithTrue);
      expect(result2.isGlobal).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle single role input', () => {
      const result = mergeRoles(baseRole);

      expect(result).toStrictEqual(baseRole);
    });

    it('should handle roles with no overlapping properties', () => {
      const minimalRole: Partial<Role> = {
        permissions: [
          {
            // @ts-expect-error test for string
            subject: 'test',
            action: 'read',
          },
        ],
      };

      const result = mergeRoles(baseRole, minimalRole);

      expect(result.name).toBe('base-role');
      expect(result.permissions).toHaveLength(2);
      expect(result.scope).toBe('org:test-org');
      expect(result.userScope).toBe('app:test-app');
      expect(result.isGlobal).toBe(false);
    });

    it('should handle roles with complex nested structures', () => {
      const complexRole: Partial<Role> = {
        permissions: [
          {
            permissions: [
              {
                permissions: [
                  {
                    // @ts-expect-error test for string
                    subject: 'deep',
                    action: 'read',
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = mergeRoles(baseRole, complexRole);

      expect(result.permissions).toHaveLength(2);

      // Check deep nesting is preserved
      const deepGroup = result.permissions.find((p) => 'permissions' in p);
      expect(deepGroup).toBeDefined();

      const deeperGroup = deepGroup?.permissions[0];
      expect(deeperGroup).toBeDefined();
      expect(deeperGroup && 'permissions' in deeperGroup).toBe(true);

      const deepestPermission =
        deeperGroup && 'permissions' in deeperGroup
          ? (deeperGroup.permissions[0] as Permission)
          : undefined;
      expect(deepestPermission?.subject).toBe('deep');
      expect(deepestPermission?.action).toBe('read');
    });
  });

  describe('type safety', () => {
    it('should maintain proper typing for merged result', () => {
      const result = mergeRoles(baseRole, roleToMerge);

      // TypeScript should infer this as Role
      expect(typeof result.name).toBe('string');
      expect(Array.isArray(result.permissions)).toBe(true);
      expect(typeof result.scope).toBe('string');
      expect(typeof result.userScope).toBe('string');
      expect(typeof result.isGlobal).toBe('boolean');
    });

    it('should handle partial role properties correctly', () => {
      const partialRole: Partial<Role> = {
        permissions: [
          {
            // @ts-expect-error test for string
            subject: 'test',
            action: 'read',
          },
        ],
      };

      const result = mergeRoles(baseRole, partialRole);

      // Should have all required properties from base role
      expect(result.name).toBeDefined();
      expect(result.permissions).toBeDefined();

      // Should have optional properties when provided
      expect(result.scope).toBeDefined();
      expect(result.userScope).toBeDefined();
      expect(result.isGlobal).toBeDefined();
    });
  });
});
