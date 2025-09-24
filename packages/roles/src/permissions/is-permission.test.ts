import { describe, it, expect } from '@jest/globals';

import { ScopeString } from '../scope';

import { isPermission } from './is-permission';
import { Permission, PermissionGroup, PermissionOrGroup, Context } from './types';

describe('isPermission', () => {
  describe('should return true for regular permissions', () => {
    it('should identify a basic permission', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
      };

      const result = isPermission(permission);
      expect(result).toBe(true);
    });

    it('should identify a permission with scope', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        scope: 'tenant:123' as ScopeString,
      };

      const result = isPermission(permission);
      expect(result).toBe(true);
    });

    it('should identify a permission with conditions', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: { userId: '123' },
      };

      const result = isPermission(permission);
      expect(result).toBe(true);
    });

    it('should identify a permission with "cannot" type', () => {
      const permission: Permission<'user', 'delete', 'cannot'> = {
        subject: 'user',
        action: 'delete',
        type: 'cannot',
      };

      const result = isPermission(permission);
      expect(result).toBe(true);
    });

    it('should identify a permission with array subjects and actions', () => {
      const permission: Permission<'user' | 'org', 'read' | 'create', 'can'> = {
        subject: ['user', 'org'],
        action: ['read', 'create'],
        type: 'can',
      };

      const result = isPermission(permission);
      expect(result).toBe(true);
    });

    it('should identify a permission without type', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
      };

      const result = isPermission(permission);
      expect(result).toBe(true);
    });

    it('should identify a permission with custom subject properties', () => {
      interface CustomContext extends Context {
        customField: string;
      }

      const permission: Permission<'user', 'read', 'can', CustomContext> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: { customField: 'value' },
      };

      const result = isPermission(permission);
      expect(result).toBe(true);
    });

    it('should identify a permission with scope and conditions', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        scope: 'tenant:123' as ScopeString,
        conditions: { userId: '123' },
      };

      const result = isPermission(permission);
      expect(result).toBe(true);
    });

    it('should identify a permission with "cannot" type, scope, and conditions', () => {
      const permission: Permission<'user', 'delete', 'cannot'> = {
        subject: 'user',
        action: 'delete',
        type: 'cannot',
        scope: 'tenant:123' as ScopeString,
        conditions: { userId: '123' },
      };

      const result = isPermission(permission);
      expect(result).toBe(true);
    });
  });

  describe('should return false for permission groups', () => {
    it('should not identify a basic permission group', () => {
      const permissionGroup: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
          },
        ],
      };

      const result = isPermission(permissionGroup);
      expect(result).toBe(false);
    });

    it('should not identify a permission group with scope', () => {
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

      const result = isPermission(permissionGroup);
      expect(result).toBe(false);
    });

    it('should not identify a permission group with conditions', () => {
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

      const result = isPermission(permissionGroup);
      expect(result).toBe(false);
    });

    it('should not identify a permission group with multiple permissions', () => {
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

      const result = isPermission(permissionGroup);
      expect(result).toBe(false);
    });

    it('should not identify a nested permission group', () => {
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

      const result = isPermission(permissionGroup);
      expect(result).toBe(false);
    });

    it('should not identify a permission group with "cannot" type', () => {
      const permissionGroup: PermissionGroup<'user', 'delete', 'cannot'> = {
        permissions: [
          {
            subject: 'user',
            action: 'delete',
            type: 'cannot',
          },
        ],
      };

      const result = isPermission(permissionGroup);
      expect(result).toBe(false);
    });

    it('should not identify a permission group with array subjects and actions', () => {
      const permissionGroup: PermissionGroup<'user' | 'org', 'read' | 'create', 'can'> = {
        permissions: [
          {
            subject: ['user', 'org'],
            action: ['read', 'create'],
            type: 'can',
          },
        ],
      };

      const result = isPermission(permissionGroup);
      expect(result).toBe(false);
    });

    it('should not identify a permission group with custom subject properties', () => {
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

      const result = isPermission(permissionGroup);
      expect(result).toBe(false);
    });

    it('should not identify an empty permission group', () => {
      const permissionGroup: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [],
      };

      const result = isPermission(permissionGroup);
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle different subject types', () => {
      const permission: Permission<'org', 'manage', 'can'> = {
        subject: 'org',
        action: 'manage',
        type: 'can',
      };

      const result = isPermission(permission);
      expect(result).toBe(true);
    });

    it('should handle different action types', () => {
      const permission: Permission<'user', 'invite', 'can'> = {
        subject: 'user',
        action: 'invite',
        type: 'can',
      };

      const result = isPermission(permission);
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

      const result = isPermission(permissionGroup);
      expect(result).toBe(false);
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

      const result = isPermission(permissionGroup);
      expect(result).toBe(false);
    });
  });

  describe('type safety', () => {
    it('should maintain type safety with type guards', () => {
      const permissionOrGroup: PermissionOrGroup<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
      };

      if (isPermission(permissionOrGroup)) {
        // TypeScript should know this is a Permission here
        // eslint-disable-next-line jest/no-conditional-expect
        expect(permissionOrGroup.subject).toBeDefined();
        // eslint-disable-next-line jest/no-conditional-expect
        expect(permissionOrGroup.action).toBeDefined();
      } else {
        throw new Error('Should not reach this branch: permissionOrGroup is not a Permission');
      }
    });

    it('should work with generic types', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
      };

      const result = isPermission<'user', 'read', 'can'>(permission);
      expect(result).toBe(true);
    });

    it('should handle both permission and group in union type', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
      };

      const permissionGroup: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
          },
        ],
      };

      const permissionResult = isPermission(permission);
      const groupResult = isPermission(permissionGroup);

      expect(permissionResult).toBe(true);
      expect(groupResult).toBe(false);
    });
  });

  describe('integration with isPermissionGroup', () => {
    it('should be mutually exclusive with isPermissionGroup', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
      };

      const permissionGroup: PermissionGroup<'user', 'read', 'can'> = {
        permissions: [
          {
            subject: 'user',
            action: 'read',
            type: 'can',
          },
        ],
      };

      // Import isPermissionGroup for this test

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports
      const { isPermissionGroup } = require('./is-permission-group');

      expect(isPermission(permission)).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      expect(isPermissionGroup(permission)).toBe(false);

      expect(isPermission(permissionGroup)).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      expect(isPermissionGroup(permissionGroup)).toBe(true);
    });
  });
});
