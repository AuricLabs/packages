import { ScopeString } from '../scope';

import { isPermissionGroup } from './is-permission-group';
import { Permission, PermissionGroup, PermissionOrGroup, Context } from './types';

describe('isPermissionGroup', () => {
  describe('should return true for permission groups', () => {
    it('should identify a basic permission group', () => {
      const permissionGroup: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
          },
        ],
      };

      const result = isPermissionGroup(permissionGroup);
      expect(result).toBe(true);
    });

    it('should identify a permission group with scope', () => {
      const permissionGroup: PermissionGroup<'user', 'read', 'can'> = {
        scope: 'tenant:123' as ScopeString,
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
            scope: 'tenant:123' as ScopeString,
          },
        ],
      };

      const result = isPermissionGroup(permissionGroup);
      expect(result).toBe(true);
    });

    it('should identify a permission group with conditions', () => {
      const permissionGroup: PermissionGroup<'user', 'read', 'can'> = {
        conditions: { userId: '123' },
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
            conditions: { userId: '123' },
          },
        ],
      };

      const result = isPermissionGroup(permissionGroup);
      expect(result).toBe(true);
    });

    it('should identify a permission group with multiple permissions', () => {
      const permissionGroup: PermissionGroup<'user' | 'org', 'read' | 'create', 'can'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
          },
          {
            subject: 'org',
            action: 'create',
            type: 'can',
          },
        ],
      };

      const result = isPermissionGroup(permissionGroup);
      expect(result).toBe(true);
    });

    it('should identify a nested permission group', () => {
      const nestedGroup: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
          },
        ],
      };

      const permissionGroup: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [nestedGroup],
      };

      const result = isPermissionGroup(permissionGroup);
      expect(result).toBe(true);
    });

    it('should identify a permission group with "cannot" type', () => {
      const permissionGroup: PermissionGroup<'user', 'delete', 'cannot'> = {
        permissions: [
          {
            subject: 'user',
            action: 'delete',
            type: 'cannot',
          },
        ],
      };

      const result = isPermissionGroup(permissionGroup);
      expect(result).toBe(true);
    });

    it('should identify a permission group with array subjects and actions', () => {
      const permissionGroup: PermissionGroup<'user' | 'org', 'read' | 'create', 'can'> = {
        permissions: [
          {
            subject: ['user', 'org'],
            action: ['read', 'create'],
            type: 'can',
          },
        ],
      };

      const result = isPermissionGroup(permissionGroup);
      expect(result).toBe(true);
    });

    it('should identify a permission group with custom subject properties', () => {
      interface CustomContext extends Context {
        customField: string;
      }

      const permissionGroup: PermissionGroup<'user', 'read', 'can', CustomContext> = {
        conditions: { customField: 'value' },
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
            conditions: { customField: 'value' },
          },
        ],
      };

      const result = isPermissionGroup(permissionGroup);
      expect(result).toBe(true);
    });
  });

  describe('should return false for regular permissions', () => {
    it('should not identify a basic permission', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
      };

      const result = isPermissionGroup(permission);
      expect(result).toBe(false);
    });

    it('should not identify a permission with scope', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        scope: 'tenant:123' as ScopeString,
      };

      const result = isPermissionGroup(permission);
      expect(result).toBe(false);
    });

    it('should not identify a permission with conditions', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: { userId: '123' },
      };

      const result = isPermissionGroup(permission);
      expect(result).toBe(false);
    });

    it('should not identify a permission with "cannot" type', () => {
      const permission: Permission<'user', 'delete', 'cannot'> = {
        subject: 'user',
        action: 'delete',
        type: 'cannot',
      };

      const result = isPermissionGroup(permission);
      expect(result).toBe(false);
    });

    it('should not identify a permission with array subjects and actions', () => {
      const permission: Permission<'user' | 'org', 'read' | 'create', 'can'> = {
        subject: ['user', 'org'],
        action: ['read', 'create'],
        type: 'can',
      };

      const result = isPermissionGroup(permission);
      expect(result).toBe(false);
    });

    it('should not identify a permission without type', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
      };

      const result = isPermissionGroup(permission);
      expect(result).toBe(false);
    });

    it('should not identify a permission with custom subject properties', () => {
      interface CustomContext extends Context {
        customField: string;
      }

      const permission: Permission<'user', 'read', 'can', CustomContext> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: { customField: 'value' },
      };

      const result = isPermissionGroup(permission);
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty permission group', () => {
      const permissionGroup: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [],
      };

      const result = isPermissionGroup(permissionGroup);
      expect(result).toBe(true);
    });

    it('should handle permission group with only nested groups', () => {
      const nestedGroup: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
          },
        ],
      };

      const permissionGroup: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [nestedGroup],
      };

      const result = isPermissionGroup(permissionGroup);
      expect(result).toBe(true);
    });

    it('should handle permission group with mixed permissions and groups', () => {
      const nestedGroup: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
          },
        ],
      };

      const permissionGroup: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
          },
          nestedGroup,
        ],
      };

      const result = isPermissionGroup(permissionGroup);
      expect(result).toBe(true);
    });

    it('should handle different subject types', () => {
      const permissionGroup: PermissionGroup<'org', 'manage', 'can'> = {
        permissions: [
          {
            subject: 'org',
            action: 'manage',
            type: 'can',
          },
        ],
      };

      const result = isPermissionGroup(permissionGroup);
      expect(result).toBe(true);
    });

    it('should handle different action types', () => {
      const permissionGroup: PermissionGroup<'user', 'invite', 'can'> = {
        permissions: [
          {
            subject: 'user',
            action: 'invite',
            type: 'can',
          },
        ],
      };

      const result = isPermissionGroup(permissionGroup);
      expect(result).toBe(true);
    });
  });

  describe('type safety', () => {
    it('should maintain type safety with type guards', () => {
      const permissionOrGroup: PermissionOrGroup<'user', 'read', 'can'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
          },
        ],
      };

      if (isPermissionGroup(permissionOrGroup)) {
        // TypeScript should know this is a PermissionGroup here
        // eslint-disable-next-line jest/no-conditional-expect
        expect(permissionOrGroup.permissions).toBeDefined();
        // eslint-disable-next-line jest/no-conditional-expect
        expect(Array.isArray(permissionOrGroup.permissions)).toBe(true);
      } else {
        throw new Error('Should not reach this branch: permissionOrGroup is not a PermissionGroup');
      }
    });

    it('should work with generic types', () => {
      const permissionGroup: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
          },
        ],
      };

      const result = isPermissionGroup<'user', 'read', 'can'>(permissionGroup);
      expect(result).toBe(true);
    });
  });
});
