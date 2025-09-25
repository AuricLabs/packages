import { describe, it, expect } from 'vitest';

import { Permission } from '../permissions';

import { createPermissionTest } from './create-permission-test';

describe('createPermissionTest', () => {
  describe('basic permission matching', () => {
    it('should match exact action and subject', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission)).toBe(true);
    });

    it('should not match different action', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'create',
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission)).toBe(false);
    });

    it('should not match different subject', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'role',
        type: 'can',
      };

      expect(test(testPermission)).toBe(false);
    });
  });

  describe('array handling', () => {
    it('should handle array actions in permission', () => {
      const permission: Permission = {
        action: ['read', 'create'],
        subject: 'user',
        type: 'can',
      };

      const test = createPermissionTest(permission);

      const testPermission1: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const testPermission2: Permission = {
        action: 'create',
        subject: 'user',
        type: 'can',
      };

      const testPermission3: Permission = {
        action: 'update',
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission1)).toBe(true);
      expect(test(testPermission2)).toBe(true);
      expect(test(testPermission3)).toBe(false);
    });

    it('should handle array subjects in permission', () => {
      const permission: Permission = {
        action: 'read',
        subject: ['user', 'role'],
        type: 'can',
      };

      const test = createPermissionTest(permission);

      const testPermission1: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const testPermission2: Permission = {
        action: 'read',
        subject: 'role',
        type: 'can',
      };

      const testPermission3: Permission = {
        action: 'read',
        subject: 'app',
        type: 'can',
      };

      expect(test(testPermission1)).toBe(true);
      expect(test(testPermission2)).toBe(true);
      expect(test(testPermission3)).toBe(false);
    });

    it('should handle array actions in test permission', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: ['read', 'create'],
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission)).toBe(false);
    });

    it('should handle array subjects in test permission', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: ['user', 'role'],
        type: 'can',
      };

      expect(test(testPermission)).toBe(false);
    });
  });

  describe('global permissions', () => {
    it('should match any action when permission has manage action', () => {
      const permission: Permission = {
        action: 'manage',
        subject: 'user',
        type: 'can',
      };

      const test = createPermissionTest(permission);

      const testPermission1: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const testPermission2: Permission = {
        action: 'create',
        subject: 'user',
        type: 'can',
      };

      const testPermission3: Permission = {
        action: 'update',
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission1)).toBe(true);
      expect(test(testPermission2)).toBe(true);
      expect(test(testPermission3)).toBe(true);
    });

    it('should match any subject when permission has all subject', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'all',
        type: 'can',
      };

      const test = createPermissionTest(permission);

      const testPermission1: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const testPermission2: Permission = {
        action: 'read',
        subject: 'role',
        type: 'can',
      };

      const testPermission3: Permission = {
        action: 'read',
        subject: 'app',
        type: 'can',
      };

      expect(test(testPermission1)).toBe(true);
      expect(test(testPermission2)).toBe(true);
      expect(test(testPermission3)).toBe(true);
    });

    it('should match any action and subject when permission has manage and all', () => {
      const permission: Permission = {
        action: 'manage',
        subject: 'all',
        type: 'can',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'delete',
        subject: 'webhook',
        type: 'can',
      };

      expect(test(testPermission)).toBe(true);
    });
  });

  describe('scope validation', () => {
    it('should match scope when both permissions have same scope', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        scope: 'org:123',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        scope: 'org:123',
      };

      expect(test(testPermission)).toBe(true);
    });

    it('should not match scope when scopes are different', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        scope: 'org:123',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        scope: 'org:456',
      };

      expect(test(testPermission)).toBe(false);
    });

    it('should match when permission has scope but test permission has no scope', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        scope: 'org:123',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission)).toBe(true);
    });

    it('should match when permission has no scope but test permission has scope', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        scope: 'org:123',
      };

      expect(test(testPermission)).toBe(true);
    });

    it('should match when both permissions have no scope', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission)).toBe(true);
    });
  });

  describe('conditions validation', () => {
    it('should match when conditions are satisfied', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        conditions: { status: 'active' },
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission, { status: 'active', role: 'admin' })).toBe(true);
    });

    it('should not match when conditions are not satisfied', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        conditions: { status: 'active' },
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        conditions: { status: 'inactive' },
      };

      expect(test(testPermission)).toBe(false);
    });

    it('should match when permission has conditions but test permission has no conditions', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        conditions: { status: 'active' },
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission)).toBe(true);
    });

    it('should match when permission has no conditions but test permission has conditions', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        conditions: { status: 'active' },
      };

      expect(test(testPermission)).toBe(true);
    });

    it('should match when both permissions have no conditions', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission)).toBe(true);
    });

    it('should handle complex conditions', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        conditions: {
          $and: [{ status: 'active' }, { $or: [{ role: 'admin' }, { role: 'user' }] }],
        },
      };

      const test = createPermissionTest(permission);

      const testPermission1: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const testPermission2: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      const testPermission3: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission1, { status: 'active', role: 'admin' })).toBe(true);
      expect(test(testPermission2, { status: 'active', role: 'user' })).toBe(true);
      expect(test(testPermission3, { status: 'inactive', role: 'admin' })).toBe(false);
    });
  });

  describe('cannot permissions', () => {
    it('should return false for matching permissions when type is cannot', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'cannot',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission)).toBe(false);
    });

    it('should return true for non-matching permissions when type is cannot', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'cannot',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'create',
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission)).toBe(true);
    });

    it('should handle cannot with global permissions', () => {
      const permission: Permission = {
        action: 'manage',
        subject: 'all',
        type: 'cannot',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'delete',
        subject: 'webhook',
        type: 'can',
      };

      expect(test(testPermission)).toBe(false);
    });
  });

  describe('combined validation', () => {
    it('should require all conditions to be met', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        scope: 'org:123',
        conditions: { status: 'active' },
      };

      const test = createPermissionTest(permission);

      const testPermission1: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        scope: 'org:123',
        conditions: { status: 'active' },
      };

      const testPermission2: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        scope: 'org:456', // Wrong scope
        conditions: { status: 'active' },
      };

      const testPermission3: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        scope: 'org:123',
        conditions: { status: 'inactive' }, // Wrong conditions
      };

      const testPermission4: Permission = {
        action: 'create', // Wrong action
        subject: 'user',
        type: 'can',
        scope: 'org:123',
        conditions: { status: 'active' },
      };

      expect(test(testPermission1)).toBe(true);
      expect(test(testPermission2)).toBe(false);
      expect(test(testPermission3)).toBe(false);
      expect(test(testPermission4)).toBe(false);
    });

    it('should handle complex permission with all features', () => {
      const permission: Permission = {
        action: ['read', 'create'],
        subject: ['user', 'role'],
        type: 'can',
        scope: 'org:123',
        conditions: { status: 'active' },
      };

      const test = createPermissionTest(permission);

      const testPermission1: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        scope: 'org:123',
        conditions: { status: 'active' },
      };

      const testPermission2: Permission = {
        action: 'create',
        subject: 'role',
        type: 'can',
        scope: 'org:123',
        conditions: { status: 'active' },
      };

      const testPermission3: Permission = {
        action: 'update', // Not in allowed actions
        subject: 'user',
        type: 'can',
        scope: 'org:123',
        conditions: { status: 'active' },
      };

      const testPermission4: Permission = {
        action: 'read',
        subject: 'app', // Not in allowed subjects
        type: 'can',
        scope: 'org:123',
        conditions: { status: 'active' },
      };

      expect(test(testPermission1)).toBe(true);
      expect(test(testPermission2)).toBe(true);
      expect(test(testPermission3)).toBe(false);
      expect(test(testPermission4)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined type (defaults to can)', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission)).toBe(true);
    });

    it('should handle empty string scope', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        scope: '',
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        scope: '',
      };

      expect(test(testPermission)).toBe(true);
    });

    it('should handle empty conditions object', () => {
      const permission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
        conditions: {},
      };

      const test = createPermissionTest(permission);

      const testPermission: Permission = {
        action: 'read',
        subject: 'user',
        type: 'can',
      };

      expect(test(testPermission, { any: 'value' })).toBe(true);
    });
  });
});
