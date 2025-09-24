import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { merge } from 'lodash';

import { Scope, ScopeString } from '../scope';

import { modifyPermission, ModifyPermissionOptions } from './modify-permission';
import { permissionGroup } from './permission-group';
import { permission } from './permission-proxy';
import { Permission, PermissionGroup, ConditionsQuery } from './types';

// Mock lodash merge to control its behavior in tests
jest.mock('lodash', () => ({
  merge: jest.fn(),
}));

const mockMerge = merge as jest.MockedFunction<typeof merge>;

describe('modifyPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementation for merge
    mockMerge.mockImplementation((target: unknown, ...sources: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return Object.assign({}, target, ...sources);
    });
  });

  describe('basic functionality', () => {
    it('should return a copy of the input permission when no options provided', () => {
      const inputPermission = permission('user', 'read', 'can');
      const options: ModifyPermissionOptions = {};

      const result = modifyPermission(inputPermission, options);

      expect(result).toStrictEqual(inputPermission);
      expect(result).not.toBe(inputPermission); // Should be a copy
    });

    it('should preserve all original permission properties', () => {
      const inputPermission: Permission<'user', 'read', 'can', { orgId: string }> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: { orgId: '123' },
        scope: 'org:123' as ScopeString,
      };
      const options: ModifyPermissionOptions<{ orgId: string }> = {};

      const result = modifyPermission(inputPermission, options);

      expect(result.subject).toBe('user');
      expect(result.action).toBe('read');
      expect(result.type).toBe('can');
      expect(result.conditions).toStrictEqual({ orgId: '123' });
      expect(result.scope).toBe('org:123');
    });
  });

  describe('scope modification', () => {
    it('should modify scope when scopePrefix is provided', () => {
      const inputPermission = permission('user', 'read', 'can', undefined, 'app:456');
      const options: ModifyPermissionOptions = {
        scopePrefix: ['org', '123'],
      };

      const result = modifyPermission(inputPermission, options);

      expect(result.scope).toBe('org:123:app:456');
    });

    it('should handle scopePrefix when permission has no scope', () => {
      const inputPermission = permission('user', 'read', 'can');
      const options: ModifyPermissionOptions = {
        scopePrefix: ['org', '123'],
      };

      const result = modifyPermission(inputPermission, options);

      expect(result.scope).toBe('org:123');
    });

    it('should handle scopePrefix when permission scope is undefined', () => {
      const inputPermission = permission('user', 'read', 'can');
      inputPermission.scope = undefined;
      const options: ModifyPermissionOptions = {
        scopePrefix: ['app', '789'],
      };

      const result = modifyPermission(inputPermission, options);

      expect(result.scope).toBe('app:789');
    });

    it('should handle various scope prefix formats', () => {
      const inputPermission = permission('user', 'read', 'can');
      const testCases: { prefix: Scope; expected: ScopeString }[] = [
        { prefix: 'system', expected: 'system' },
        { prefix: ['org', '123'], expected: 'org:123' },
        { prefix: ['app', '456'], expected: 'app:456' },
        {
          prefix: ['org', '123', 'app', '456'],
          expected: 'org:123:app:456',
        },
      ];

      testCases.forEach(({ prefix, expected }) => {
        const options: ModifyPermissionOptions = { scopePrefix: prefix };
        const result = modifyPermission(inputPermission, options);
        expect(result.scope).toBe(expected);
      });
    });

    it('should handle empty scope prefix', () => {
      const inputPermission = permission('user', 'read', 'can', undefined, 'org:123');
      const options: ModifyPermissionOptions = {
        scopePrefix: '',
      };

      const result = modifyPermission(inputPermission, options);

      expect(result.scope).toBe('org:123');
    });

    it('should handle undefined scope prefix', () => {
      const inputPermission = permission('user', 'read', 'can', undefined, 'org:123');
      const options: ModifyPermissionOptions = {
        scopePrefix: undefined,
      };

      const result = modifyPermission(inputPermission, options);

      expect(result.scope).toBe('org:123'); // Should remain unchanged
    });
  });

  describe('conditions modification', () => {
    it('should merge additional conditions when provided', () => {
      const inputPermission = permission('user', 'read', 'can', {
        orgId: '123',
      });
      const additionalConditions = { userId: '456' };
      const options: ModifyPermissionOptions = {
        additionalConditions,
      };

      const result = modifyPermission(inputPermission, options);

      expect(mockMerge).toHaveBeenCalledWith({}, { orgId: '123' }, { userId: '456' });
      expect(result.conditions).toStrictEqual({ orgId: '123', userId: '456' });
    });

    it('should handle permission with no existing conditions', () => {
      const inputPermission = permission('user', 'read', 'can');
      const additionalConditions = { orgId: '123' };
      const options: ModifyPermissionOptions = {
        additionalConditions,
      };

      const result = modifyPermission(inputPermission, options);

      expect(mockMerge).toHaveBeenCalledWith({}, undefined, { orgId: '123' });
      expect(result.conditions).toStrictEqual({ orgId: '123' });
    });

    it('should handle undefined additional conditions', () => {
      const inputPermission = permission('user', 'read', 'can', {
        orgId: '123',
      });
      const options: ModifyPermissionOptions = {
        additionalConditions: undefined,
      };

      const result = modifyPermission(inputPermission, options);

      expect(mockMerge).not.toHaveBeenCalled();
      expect(result.conditions).toStrictEqual({ orgId: '123' }); // Should remain unchanged
    });

    it('should handle complex conditions objects', () => {
      const inputPermission: Permission = permission('user', 'read', 'can', {
        $and: [{ orgId: '123' }],
      });
      const additionalConditions: ConditionsQuery<{ userId: string; orgId: string }> = {
        // @ts-expect-error test for $or
        $or: [{ userId: '456' }, { userId: '789' }],
      };
      const options: ModifyPermissionOptions<{ userId: string; orgId: string }> = {
        additionalConditions,
      };

      mockMerge.mockReturnValue({
        $and: [{ orgId: '123' }],
        $or: [{ userId: '456' }, { userId: '789' }],
      });

      const result = modifyPermission(inputPermission, options);

      expect(mockMerge).toHaveBeenCalledWith(
        {},
        { $and: [{ orgId: '123' }] },
        { $or: [{ userId: '456' }, { userId: '789' }] },
      );
      expect(result.conditions).toStrictEqual({
        $and: [{ orgId: '123' }],
        $or: [{ userId: '456' }, { userId: '789' }],
      });
    });

    it('should handle empty conditions objects', () => {
      const inputPermission = permission('user', 'read', 'can', {});
      const additionalConditions = {};
      const options: ModifyPermissionOptions = {
        additionalConditions,
      };

      const result = modifyPermission(inputPermission, options);

      expect(mockMerge).toHaveBeenCalledWith({}, {}, {});
      expect(result.conditions).toStrictEqual({});
    });
  });

  describe('combined modifications', () => {
    it('should handle both scope and conditions modifications', () => {
      const inputPermission = permission('user', 'read', 'can', { orgId: '123' }, 'app:456');
      const options: ModifyPermissionOptions<{ userId: string; orgId: string }> = {
        scopePrefix: ['org', '789'],
        additionalConditions: { userId: '456' },
      };

      const result = modifyPermission(inputPermission, options);

      expect(result.scope).toBe('org:789:app:456');
      expect(mockMerge).toHaveBeenCalledWith({}, { orgId: '123' }, { userId: '456' });
      expect(result.conditions).toStrictEqual({ orgId: '123', userId: '456' });
    });

    it('should preserve other properties when modifying scope and conditions', () => {
      const inputPermission: Permission<
        'user',
        'read',
        'cannot',
        { orgId: string; userId: string }
      > = {
        subject: 'user',
        action: 'read',
        type: 'cannot',
        conditions: { orgId: '123' },
        scope: 'app:456' as ScopeString,
      };
      const options: ModifyPermissionOptions<{ userId: string }> = {
        scopePrefix: ['org', '789'],
        additionalConditions: { userId: '456' },
      };

      const result = modifyPermission(inputPermission, options);

      expect(result.subject).toBe('user');
      expect(result.action).toBe('read');
      expect(result.type).toBe('cannot');
      expect(result.scope).toBe('org:789:app:456');
      expect(result.conditions).toStrictEqual({ orgId: '123', userId: '456' });
    });
  });

  describe('different permission types', () => {
    it('should work with Permission objects', () => {
      const inputPermission: Permission<'user', 'read', 'can', { orgId: string; userId: string }> =
        {
          subject: 'user',
          action: 'read',
          type: 'can',
          conditions: { orgId: '123' },
          scope: 'org:123',
        };
      const options: ModifyPermissionOptions<{ userId: string }> = {
        scopePrefix: ['app', '456'],
        additionalConditions: { userId: '789' },
      };

      const result = modifyPermission(inputPermission, options);

      expect(result.subject).toBe('user');
      expect(result.scope).toBe('app:456:org:123');
      expect(result.conditions).toStrictEqual({ orgId: '123', userId: '789' });
    });

    it('should work with PermissionGroup objects', () => {
      const inputPermissionGroup: PermissionGroup<
        'user',
        'read' | 'create',
        'can',
        { orgId: string; userId: string }
      > = {
        permissions: [permission('user', 'read', 'can'), permission('user', 'create', 'can')],
        conditions: { orgId: '123' },
        scope: 'org:123',
      };
      const options: ModifyPermissionOptions<{ userId: string }> = {
        scopePrefix: ['app', '456'],
        additionalConditions: { userId: '789' },
      };

      const result = modifyPermission(inputPermissionGroup, options);

      expect(result.permissions).toHaveLength(2);
      expect(result.scope).toBe('app:456:org:123');
      expect(result.conditions).toStrictEqual({ orgId: '123', userId: '789' });
    });

    it('should work with AnyPermission types', () => {
      const inputPermission: Permission = permission('user', 'read', 'can', {
        orgId: '123',
      });
      const options: ModifyPermissionOptions<{ userId: string }> = {
        scopePrefix: ['app', '456'],
        additionalConditions: { userId: '789' },
      };

      const result = modifyPermission(inputPermission, options);

      expect(result.subject).toBe('user');
      expect(result.scope).toBe('app:456');
      expect(result.conditions).toStrictEqual({ orgId: '123', userId: '789' });
    });

    it('should work with cannot permissions', () => {
      const inputPermission = permission('user', 'delete', 'cannot');
      const options: ModifyPermissionOptions = {
        scopePrefix: ['org', '123'],
        additionalConditions: { userId: '456' },
      };

      const result = modifyPermission(inputPermission, options);

      expect(result.type).toBe('cannot');
      expect(result.action).toBe('delete');
      expect(result.subject).toBe('user');
      expect(result.scope).toBe('org:123');
      expect(result.conditions).toStrictEqual({ userId: '456' });
    });
  });

  describe('type safety', () => {
    it('should maintain generic type constraints for Permission', () => {
      const inputPermission: Permission<'user', 'read', 'can', { orgId: string; userId: string }> =
        {
          subject: 'user',
          action: 'read',
          type: 'can',
          conditions: { orgId: '123' },
        };
      const options: ModifyPermissionOptions<{ userId: string }> = {
        additionalConditions: { userId: '456' },
      };

      const result = modifyPermission(inputPermission, options);

      // TypeScript should enforce that result has the same type constraints
      expect(result.subject).toBe('user');
      expect(result.action).toBe('read');
      expect(result.type).toBe('can');
    });

    it('should maintain generic type constraints for PermissionGroup', () => {
      const inputPermissionGroup: PermissionGroup<
        'user',
        'read' | 'create',
        'can',
        { orgId: string; userId: string }
      > = {
        permissions: [permission('user', 'read', 'can'), permission('user', 'create', 'can')],
        conditions: { orgId: '123' },
      };
      const options: ModifyPermissionOptions<{ userId: string }> = {
        additionalConditions: { userId: '456' },
      };

      const result = modifyPermission(inputPermissionGroup, options);

      // TypeScript should enforce that result has the same type constraints
      expect(result.permissions).toHaveLength(2);
      expect('subject' in result.permissions[0] && result.permissions[0].subject).toBe('user');
    });

    it('should work with different subject and action combinations', () => {
      const testCases = [
        { subject: 'user' as const, action: 'read' as const },
        { subject: 'org' as const, action: 'manage' as const },
        { subject: 'app' as const, action: 'assign' as const },
        { subject: 'role' as const, action: 'unassign' as const },
        { subject: 'all' as const, action: 'create' as const },
      ];

      testCases.forEach(({ subject, action }) => {
        const inputPermission = permission(subject, action, 'can');
        const options: ModifyPermissionOptions = {
          scopePrefix: ['org', '123'],
        };

        const result = modifyPermission(inputPermission, options);

        expect(result.subject).toBe(subject);
        expect(result.action).toBe(action);
        expect(result.scope).toBe('org:123');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle permission with all properties undefined', () => {
      const inputPermission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: undefined,
        scope: undefined,
      };
      const options: ModifyPermissionOptions = {};

      const result = modifyPermission(inputPermission, options);

      expect(result.subject).toBe('user');
      expect(result.action).toBe('read');
      expect(result.type).toBe('can');
      expect(result.conditions).toBeUndefined();
      expect(result.scope).toBeUndefined();
    });

    it('should handle permission with empty conditions object', () => {
      const inputPermission = permission('user', 'read', 'can', {});
      const options: ModifyPermissionOptions = {
        additionalConditions: { userId: '123' },
      };

      const result = modifyPermission(inputPermission, options);

      expect(mockMerge).toHaveBeenCalledWith({}, {}, { userId: '123' });
      expect(result.conditions).toStrictEqual({ userId: '123' });
    });

    it('should handle permission with empty scope string', () => {
      const inputPermission = permission('user', 'read', 'can');
      inputPermission.scope = '';
      const options: ModifyPermissionOptions = {
        scopePrefix: ['org', '123'],
      };

      const result = modifyPermission(inputPermission, options);

      expect(result.scope).toBe('org:123');
    });

    it('should handle permission with null-like values', () => {
      const inputPermission = permission('user', 'read', 'can');
      const options: ModifyPermissionOptions = {
        // @ts-expect-error test for null
        scopePrefix: null,
        // @ts-expect-error test for null
        additionalConditions: null,
      };

      const result = modifyPermission(inputPermission, options);

      expect(result.scope).toBeUndefined();
      expect(result.conditions).toBeUndefined();
    });
  });

  describe('real-world usage scenarios', () => {
    it('should handle user permission with organization context', () => {
      const userPermission: Permission = permission('user', 'read', 'can', {
        userId: '123',
      });
      const options: ModifyPermissionOptions<{ orgId: string }> = {
        scopePrefix: ['org', '456'],
        additionalConditions: { orgId: '456' },
      };

      const result = modifyPermission(userPermission, options);

      expect(result.scope).toBe('org:456');
      expect(result.conditions).toStrictEqual({ userId: '123', orgId: '456' });
    });

    it('should handle role permission with application context', () => {
      const rolePermission: Permission = permission('role', 'assign', 'can', {
        roleId: '789',
      });
      const options: ModifyPermissionOptions<{ appId: string }> = {
        scopePrefix: ['app', '101'],
        additionalConditions: { appId: '101' },
      };

      const result = modifyPermission(rolePermission, options);

      expect(result.scope).toBe('app:101');
      expect(result.conditions).toStrictEqual({ roleId: '789', appId: '101' });
    });

    it('should handle system-wide permission with tenant context', () => {
      const systemPermission = permission('all', 'manage', 'can');
      const options: ModifyPermissionOptions<{ tenantId: string }> = {
        scopePrefix: ['org', '202'],
        additionalConditions: { tenantId: '202' },
      };

      const result = modifyPermission(systemPermission, options);

      expect(result.scope).toBe('org:202');
      expect(result.conditions).toStrictEqual({ tenantId: '202' });
    });

    it('should handle permission group with nested context', () => {
      const permissionGroupObj = permissionGroup(
        [permission('user', 'read', 'can'), permission('user', 'create', 'can')],
        { orgId: '123' },
      );
      const options: ModifyPermissionOptions<{ userId: string }> = {
        scopePrefix: ['org', '123', 'app', '456'],
        additionalConditions: { userId: '789' },
      };

      const result = modifyPermission(permissionGroupObj, options);

      expect(result.scope).toBe('org:123:app:456');
      expect(result.conditions).toStrictEqual({ orgId: '123', userId: '789' });
      expect(result.permissions).toHaveLength(2);
    });
  });

  describe('lodash merge integration', () => {
    it('should use lodash merge for conditions', () => {
      const inputPermission = permission('user', 'read', 'can', {
        orgId: '123',
      });
      const additionalConditions = { userId: '456' };
      const options: ModifyPermissionOptions = {
        additionalConditions,
      };

      mockMerge.mockReturnValue({ orgId: '123', userId: '456' });

      const result = modifyPermission(inputPermission, options);

      expect(mockMerge).toHaveBeenCalledWith({}, { orgId: '123' }, { userId: '456' });
      expect(result.conditions).toStrictEqual({ orgId: '123', userId: '456' });
    });

    it('should handle merge returning different object structure', () => {
      const inputPermission = permission('user', 'read', 'can', {
        orgId: '123',
      });
      const additionalConditions = { $and: [{ userId: '456' }] };
      const options: ModifyPermissionOptions = {
        additionalConditions,
      };

      const mergedResult = { orgId: '123', $and: [{ userId: '456' }] };
      mockMerge.mockReturnValue(mergedResult);

      const result = modifyPermission(inputPermission, options);

      expect(result.conditions).toBe(mergedResult);
    });
  });
});
