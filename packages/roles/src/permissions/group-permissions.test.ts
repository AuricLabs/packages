import { describe, it, expect } from 'vitest';

import { groupPermissions } from './group-permissions';
import { isPermission } from './is-permission';
import { isPermissionGroup } from './is-permission-group';
import { permissionGroup } from './permission-group';
import { permission } from './permission-proxy';
import { Permission, PermissionGroup } from './types';

describe('groupPermissions', () => {
  describe('basic functionality', () => {
    it('should return empty array for empty permissions', () => {
      const result = groupPermissions([]);
      expect(result).toStrictEqual([]);
    });

    it('should group permissions with same conditions and scope', () => {
      const permissions = [
        permission('user', 'read', 'can', { orgId: '123' }, 'org:123'),
        permission('user', 'create', 'can', { orgId: '123' }, 'org:123'),
        permission('org', 'read', 'can', { orgId: '123' }, 'org:123'),
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(1);
      expect(result[0]).toStrictEqual({
        permissions: [
          permission('user', 'read', 'can'),
          permission('user', 'create', 'can'),
          permission('org', 'read', 'can'),
        ],
        conditions: { orgId: '123' },
        scope: 'org:123',
      });
    });

    it('should create separate groups for different conditions', () => {
      const permissions = [
        permission('user', 'read', 'can', { orgId: '123' }, 'org:123'),
        permission('user', 'create', 'can', { orgId: '456' }, 'org:456'),
        permission('org', 'read', 'can', { orgId: '123' }, 'org:123'),
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(2);

      const group1 = result.find((g) => g.conditions?.orgId === '123');
      const group2 = result.find((g) => g.conditions?.orgId === '456');

      expect(group1).toBeDefined();
      expect(group1?.permissions).toHaveLength(2);
      expect(group1?.scope).toBe('org:123');

      expect(group2).toBeDefined();
      expect(group2?.permissions).toHaveLength(1);
      expect(group2?.scope).toBe('org:456');
    });

    it('should create separate groups for different scopes', () => {
      const permissions = [
        permission('user', 'read', 'can', { orgId: '123' }, 'org:123'),
        permission('user', 'create', 'can', { orgId: '123' }, 'org:456'),
        permission('org', 'read', 'can', { orgId: '123' }, 'org:123'),
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(2);

      const group1 = result.find((g) => g.scope === 'org:123');
      const group2 = result.find((g) => g.scope === 'org:456');

      expect(group1).toBeDefined();
      expect(group1?.permissions).toHaveLength(2);
      expect(group1?.conditions).toStrictEqual({ orgId: '123' });

      expect(group2).toBeDefined();
      expect(group2?.permissions).toHaveLength(1);
      expect(group2?.conditions).toStrictEqual({ orgId: '123' });
    });

    it('should handle permissions without conditions or scope', () => {
      const permissions = [
        permission('user', 'read'),
        permission('user', 'create'),
        permission('org', 'read', 'can', undefined, 'org:123'),
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(2);

      const group1 = result.find((g) => g.conditions === undefined && g.scope === undefined);
      const group2 = result.find((g) => g.scope === 'org:123');

      expect(group1).toBeDefined();
      expect(group1?.permissions).toHaveLength(2);

      expect(group2).toBeDefined();
      expect(group2?.permissions).toHaveLength(1);
    });
  });

  describe('permission groups handling', () => {
    it('should add the new permission to the existing group preserving the existing group', () => {
      const existingGroup = permissionGroup(
        [permission('user', 'read')],
        { orgId: '123' },
        'org:123',
      );

      const permissions = [
        existingGroup,
        permission('user', 'create', 'can', { orgId: '123' }, 'org:123'),
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(1);

      // The existing group should be cloned and the new permission should be added to it
      const group = result.find(
        (g) =>
          g.conditions?.orgId === '123' &&
          g.scope === 'org:123' &&
          g.permissions.some((p) => 'action' in p && p.action === 'read'),
      );
      expect(group).toBeDefined();
      expect(group?.permissions).toHaveLength(2);
      expect(group?.permissions).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: 'read' }),
          expect.objectContaining({ action: 'create' }),
        ]),
      );
      expect(group?.conditions).toStrictEqual({ orgId: '123' });
      expect(group?.scope).toBe('org:123');
    });

    it('should handle mixed permissions and groups', () => {
      const existingGroup = permissionGroup(
        [permission('user', 'read')],
        { orgId: '123' },
        'org:123',
      );

      const permissions = [
        existingGroup,
        permission('user', 'create', 'can', { orgId: '123' }, 'org:123'),
        permission('org', 'read', 'can', { orgId: '456' }, 'org:456'),
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(2);

      // The existing group should be cloned and preserved
      const clonedGroup = result.find(
        (g) =>
          g.conditions?.orgId === '123' &&
          g.scope === 'org:123' &&
          g.permissions.some((p) => 'action' in p && p.action === 'read'),
      );
      expect(clonedGroup).toBeDefined();

      // The create permission should be grouped with the existing group
      const createGroup = result.find((g) =>
        g.permissions.some((p) => 'action' in p && p.action === 'create'),
      );
      expect(createGroup?.permissions).toHaveLength(2);
      expect(createGroup?.conditions).toStrictEqual({ orgId: '123' });
      expect(createGroup?.scope).toBe('org:123');

      // The org read permission should be in its own group
      const orgGroup = result.find((g) =>
        g.permissions.some((p) => 'subject' in p && p.subject === 'org'),
      );

      expect(orgGroup?.permissions).toHaveLength(1);
      expect(orgGroup?.conditions).toStrictEqual({ orgId: '456' });
      expect(orgGroup?.scope).toBe('org:456');
    });

    it('should add permission group as child when it partially matches (has scope after normalization)', () => {
      const existingGroup = permissionGroup(
        [permission('user', 'read')],
        { orgId: '123' },
        'org:123',
      );

      const newGroup = permissionGroup(
        [permission('user', 'create')],
        { orgId: '123' },
        'org:456', // Different scope
      );

      const permissions = [existingGroup, newGroup];

      const result = groupPermissions(permissions, { ignoreScope: true });

      expect(result).toHaveLength(1);
      expect(result[0].permissions).toHaveLength(2);

      // The first permission should be the original read permission
      expect(result[0].permissions[0]).toStrictEqual(expect.objectContaining({ action: 'read' }));

      // The second permission should be the entire new group (not flattened)
      expect(result[0].permissions[1].conditions).toBeUndefined();
      expect(result[0].permissions[1].scope).toBe('org:456');
    });

    it('should add permission group as child when it partially matches (has conditions after normalization)', () => {
      const existingGroup = permissionGroup(
        [permission('user', 'read')],
        { orgId: '123' },
        'org:123',
      );

      const newGroup = permissionGroup(
        [permission('user', 'create')],
        { orgId: '456' }, // Different conditions
        'org:123', // Different scope
      );

      const permissions = [existingGroup, newGroup];

      const result = groupPermissions(permissions, { ignoreConditions: true });

      expect(result).toHaveLength(1);
      expect(result[0].permissions).toHaveLength(2);

      const p = result[0].permissions.find(isPermission);
      const group = result[0].permissions.find(isPermissionGroup);

      // The first permission should be the original read permission
      expect(p).toStrictEqual(expect.objectContaining({ action: 'read', subject: 'user' }));

      // The second permission should be the entire new group (not flattened)
      expect(group?.permissions).toHaveLength(1);
      expect(group?.scope).toBeUndefined();
      expect(group?.conditions).toStrictEqual({ orgId: '456' });
    });

    it('should not add permission group as child when it does not match (has both scope and conditions after normalization)', () => {
      const existingGroup = permissionGroup(
        [permission('user', 'read')],
        { orgId: '123' },
        'org:123',
      );

      const newGroup = permissionGroup(
        [permission('user', 'create')],
        { orgId: '456' }, // Different conditions
        'org:123', // Different scope
      );

      const permissions = [existingGroup, newGroup];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(2);
      expect(result[0].permissions).toHaveLength(1);
      expect(result[1].permissions).toHaveLength(1);
    });

    it('should merge permission groups when they match 100% (no scope or conditions after normalization)', () => {
      const existingGroup = permissionGroup(
        [permission('user', 'read')],
        { orgId: '123' },
        'org:123',
      );

      const newGroup = permissionGroup(
        [permission('user', 'create')],
        { orgId: '123' }, // Same conditions
        'org:123', // Same scope
      );

      const permissions = [existingGroup, newGroup];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(1);
      expect(result[0].permissions).toHaveLength(2);

      // Both permissions should be flattened (not nested groups)
      expect(result[0].permissions[0]).toStrictEqual(expect.objectContaining({ action: 'read' }));
      expect(result[0].permissions[1]).toStrictEqual(expect.objectContaining({ action: 'create' }));

      // Neither should be a permission group
      expect(result[0].permissions[0]).not.toHaveProperty('permissions');
      expect(result[0].permissions[1]).not.toHaveProperty('permissions');
    });

    it('should handle global scope correctly when creating new permission groups', () => {
      const permissions = [
        permission('user', 'read', 'can', { orgId: '123' }, 'system'), // global scope
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(1);
      const group = result.find(isPermissionGroup) as PermissionGroup;
      expect(group.permissions).toHaveLength(1);
      expect(group.conditions).toStrictEqual({ orgId: '123' });
      expect(group.scope).toBe('system'); // global scope should not be included
    });

    it('should handle empty scope correctly when creating new permission groups', () => {
      const permissions = [
        permission('user', 'read', 'can', { orgId: '123' }, ''), // empty scope
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(1);
      expect(result[0].permissions).toHaveLength(1);
      expect(result[0].conditions).toStrictEqual({ orgId: '123' });
      expect(result[0].scope).toBeUndefined(); // empty scope should not be included
    });

    it('should handle undefined scope correctly when creating new permission groups', () => {
      const permissions = [
        permission('user', 'read', 'can', { orgId: '123' }, undefined), // undefined scope
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(1);
      expect(result[0].permissions).toHaveLength(1);
      expect(result[0].conditions).toStrictEqual({ orgId: '123' });
      expect(result[0].scope).toBeUndefined(); // undefined scope should not be included
    });
  });

  describe('ignoreScope option', () => {
    it('should ignore scope when grouping with ignoreScope: true', () => {
      const permissions = [
        permission('user', 'read', 'can', { orgId: '123' }, 'org:123'),
        permission('user', 'create', 'can', { orgId: '123' }, 'org:456'),
        permission('org', 'read', 'can', { orgId: '123' }, 'org:789'),
      ];

      const result = groupPermissions(permissions, { ignoreScope: true });

      expect(result).toHaveLength(1);
      expect(result[0].permissions).toHaveLength(3);
      expect(result[0].conditions).toStrictEqual({ orgId: '123' });
      expect(result[0].scope).toBeUndefined();
    });

    it('should still group by conditions when ignoreScope: true', () => {
      const permissions = [
        permission('user', 'read', 'can', { orgId: '123' }, 'org:123'),
        permission('user', 'create', 'can', { orgId: '456' }, 'org:456'),
        permission('org', 'read', 'can', { orgId: '123' }, 'org:789'),
      ];

      const result = groupPermissions(permissions, { ignoreScope: true });

      expect(result).toHaveLength(2);

      const group1 = result.find((g) => g.conditions?.orgId === '123');
      const group2 = result.find((g) => g.conditions?.orgId === '456');

      expect(group1?.permissions).toHaveLength(2);
      expect(group2?.permissions).toHaveLength(1);
    });
  });

  describe('ignoreConditions option', () => {
    it('should ignore conditions when grouping with ignoreConditions: true', () => {
      const permissions = [
        permission('user', 'read', 'can', { orgId: '123' }, 'org:123'),
        permission('user', 'create', 'can', { orgId: '456' }, 'org:123'),
        permission('org', 'read', 'can', { orgId: '789' }, 'org:123'),
      ];

      const result = groupPermissions(permissions, { ignoreConditions: true });

      expect(result).toHaveLength(1);
      expect(result[0].permissions).toHaveLength(3);
      expect(result[0].conditions).toBeUndefined();
      expect(result[0].scope).toBe('org:123');
    });

    it('should still group by scope when ignoreConditions: true', () => {
      const permissions = [
        permission('user', 'read', 'can', { orgId: '123' }, 'org:123'),
        permission('user', 'create', 'can', { orgId: '456' }, 'org:456'),
        permission('org', 'read', 'can', { orgId: '789' }, 'org:123'),
      ];

      const result = groupPermissions(permissions, { ignoreConditions: true });

      expect(result).toHaveLength(2);

      const group1 = result.find((g) => g.scope === 'org:123');
      const group2 = result.find((g) => g.scope === 'org:456');

      expect(group1?.permissions).toHaveLength(2);
      expect(group2?.permissions).toHaveLength(1);
    });
  });

  describe('both ignore options', () => {
    it('should ignore both scope and conditions when both options are true', () => {
      const permissions = [
        permission('user', 'read', 'can', { orgId: '123' }, 'org:123'),
        permission('user', 'create', 'can', { orgId: '456' }, 'org:456'),
        permission('org', 'read', 'can', { orgId: '789' }, 'org:789'),
      ];

      const result = groupPermissions(permissions, {
        ignoreScope: true,
        ignoreConditions: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].permissions).toHaveLength(3);
      expect(result[0].conditions).toBeUndefined();
      expect(result[0].scope).toBeUndefined();
    });

    it('should group all permissions together when both options are true', () => {
      const permissions: Permission[] = [
        permission('user', 'read', 'can', { orgId: '123' }, 'org:123'),
        permission('user', 'create', 'can', { orgId: '456' }, 'org:456'),
        permission('org', 'read', 'can', { orgId: '789' }, 'org:789'),
        permission('app', 'create', 'cannot', { appId: '999' }, 'app:999'),
      ];

      const result = groupPermissions(permissions, {
        ignoreScope: true,
        ignoreConditions: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].permissions).toHaveLength(4);
      expect(result[0].conditions).toBeUndefined();
      expect(result[0].scope).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle permissions with undefined conditions and scope', () => {
      const permissions = [
        permission('user', 'read'),
        permission('user', 'create'),
        permission('org', 'read'),
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(1);
      expect(result[0].permissions).toHaveLength(3);
      expect(result[0].conditions).toBeUndefined();
      expect(result[0].scope).toBeUndefined();
    });

    it('should not add duplicate permissions to the same group', () => {
      const permissions = [
        permission('user', 'read', 'can', { orgId: '123' }, 'org:123'),
        permission('user', 'read', 'can', { orgId: '123' }, 'org:123'), // duplicate
        permission('user', 'create', 'can', { orgId: '123' }, 'org:123'),
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(1);
      expect(result[0].permissions).toHaveLength(2); // should only have read and create, not duplicate read
      expect(result[0].permissions).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({ action: 'read' }),
          expect.objectContaining({ action: 'create' }),
        ]),
      );
    });

    it('should not add duplicate permissions even when they have different conditions or scope', () => {
      const permissions = [
        permission('user', 'read', 'can', { orgId: '123' }, 'org:123'),
        permission('user', 'read', 'can', { orgId: '456' }, 'org:456'), // different conditions and scope
        permission('user', 'create', 'can', { orgId: '123' }, 'app:123'),
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(3); // should create separate groups for different conditions/scope

      // Each group should have only one permission
      result.forEach((group) => {
        expect(group.permissions).toHaveLength(1);
      });
    });

    it('should handle permissions with empty conditions object', () => {
      const permissions = [
        permission('user', 'read', 'can', {}),
        permission('user', 'create', 'can', {}),
        permission('org', 'read', 'can', { orgId: '123' }),
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(2);

      const emptyConditionsGroup = result.find(
        (g) => g.conditions && Object.keys(g.conditions).length === 0,
      );
      const orgGroup = result.find((g) => g.conditions?.orgId === '123');

      expect(emptyConditionsGroup?.permissions).toHaveLength(2);
      expect(orgGroup?.permissions).toHaveLength(1);
    });

    it('should handle permissions with empty scope string', () => {
      const permissions = [
        permission('user', 'read', 'can', undefined, ''),
        permission('user', 'create', 'can', undefined, ''),
        permission('org', 'read', 'can', undefined, 'org:123'),
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(2);

      const emptyScopeGroup = result.find((g) => g.scope === undefined);
      const orgGroup = result.find((g) => g.scope === 'org:123');

      expect(emptyScopeGroup?.permissions).toHaveLength(2);
      expect(orgGroup?.permissions).toHaveLength(1);
    });

    it('should handle complex nested conditions', () => {
      const complexConditions1 = {
        $and: [{ orgId: '123' }, { $or: [{ userId: '456' }, { role: 'admin' }] }],
      };

      const complexConditions2 = {
        $and: [{ orgId: '123' }, { $or: [{ userId: '789' }, { role: 'user' }] }],
      };

      const permissions = [
        permission('user', 'read', 'can', complexConditions1, 'org:123'),
        permission('user', 'create', 'can', complexConditions1, 'org:123'),
        permission('org', 'read', 'can', complexConditions2, 'org:123'),
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(2);

      const group1 = result.find((g) => g.conditions === complexConditions1);
      const group2 = result.find((g) => g.conditions === complexConditions2);

      expect(group1?.permissions).toHaveLength(2);
      expect(group2?.permissions).toHaveLength(1);
    });
  });

  describe('type safety', () => {
    it('should work with generic type constraints', () => {
      const permissions = [
        permission('user', 'read'),
        permission('org', 'manage'),
        permission('app', 'create'),
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(1);
      expect(result[0].permissions).toHaveLength(3);
    });

    it('should handle different action types', () => {
      const permissions = [
        permission('user', 'read', 'can'),
        permission('user', 'delete', 'cannot'),
        permission('org', 'manage', 'can'),
      ];

      const result = groupPermissions(permissions);

      expect(result).toHaveLength(1);
      expect(result[0].permissions).toHaveLength(3);
    });
  });
});
