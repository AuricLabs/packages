import { describe, it, expect } from '@jest/globals';

import { ScopeString } from '../scope';

import { permission } from './permission-proxy';
import { stringifyPermission } from './stringify-permission';
import { Permission, Subject, Action, ActionType, ConditionsQuery } from './types';

describe('permission proxy', () => {
  describe('proxy property access', () => {
    it('should return permission string when accessing subject.action', () => {
      expect(stringifyPermission(permission.user.read)).toBe('user:read');
      expect(stringifyPermission(permission.org.manage)).toBe('org:manage');
      expect(stringifyPermission(permission.app.assign)).toBe('app:assign');
      expect(stringifyPermission(permission.role.unassign)).toBe('role:unassign');
    });

    it('should create permission object when called as function with subject and action', () => {
      const userReadPermission = permission.user('read', 'can');
      const orgManagePermission = permission.org('manage', 'can');

      expect(userReadPermission).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
      });

      expect(orgManagePermission).toStrictEqual({
        subject: 'org',
        action: 'manage',
        type: 'can',
      });
    });

    it('should work with all defined subjects and actions', () => {
      // Test all subjects
      expect(stringifyPermission(permission.all.read)).toBe('all:read');
      expect(stringifyPermission(permission.all.create)).toBe('all:create');
      expect(stringifyPermission(permission.all.update)).toBe('all:update');
      expect(stringifyPermission(permission.all.delete)).toBe('all:delete');
      expect(stringifyPermission(permission.all.manage)).toBe('all:manage');

      expect(stringifyPermission(permission.org.read)).toBe('org:read');
      expect(stringifyPermission(permission.org.create)).toBe('org:create');
      expect(stringifyPermission(permission.org.update)).toBe('org:update');
      expect(stringifyPermission(permission.org.delete)).toBe('org:delete');
      expect(stringifyPermission(permission.org.manage)).toBe('org:manage');

      expect(stringifyPermission(permission.app.read)).toBe('app:read');
      expect(stringifyPermission(permission.app.create)).toBe('app:create');
      expect(stringifyPermission(permission.app.update)).toBe('app:update');
      expect(stringifyPermission(permission.app.delete)).toBe('app:delete');
      expect(stringifyPermission(permission.app.manage)).toBe('app:manage');
      expect(stringifyPermission(permission.app.assign)).toBe('app:assign');
      expect(stringifyPermission(permission.app.unassign)).toBe('app:unassign');

      expect(stringifyPermission(permission.role.read)).toBe('role:read');
      expect(stringifyPermission(permission.role.create)).toBe('role:create');
      expect(stringifyPermission(permission.role.update)).toBe('role:update');
      expect(stringifyPermission(permission.role.delete)).toBe('role:delete');
      expect(stringifyPermission(permission.role.manage)).toBe('role:manage');
      expect(stringifyPermission(permission.role.assign)).toBe('role:assign');
      expect(stringifyPermission(permission.role.unassign)).toBe('role:unassign');

      expect(stringifyPermission(permission.user.read)).toBe('user:read');
      expect(stringifyPermission(permission.user.create)).toBe('user:create');
      expect(stringifyPermission(permission.user.update)).toBe('user:update');
      expect(stringifyPermission(permission.user.delete)).toBe('user:delete');
      expect(stringifyPermission(permission.user.manage)).toBe('user:manage');
      expect(stringifyPermission(permission.user.invite)).toBe('user:invite');
      expect(stringifyPermission(permission.user.remove)).toBe('user:remove');
    });
  });

  describe('proxy function calls', () => {
    it('should create permission object when called as function with subject, action, type', () => {
      const result = permission('user', 'read', 'can');

      expect(result).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
      });
    });

    it('should create permission object with arrays for subject and action', () => {
      const result = permission(['user', 'org'], ['read', 'create'], 'can');

      expect(result).toStrictEqual({
        subject: ['user', 'org'],
        action: ['read', 'create'],
        type: 'can',
      });
    });

    it('should create permission object with conditions and scope', () => {
      const conditions = { userId: '123' };
      const scope = 'tenant:123' as ScopeString;
      const result = permission('user', 'read', 'can', conditions, scope);

      expect(result).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions,
        scope,
      });
    });

    it('should create permission object with type "cannot"', () => {
      const result = permission('user', 'delete', 'cannot');

      expect(result).toStrictEqual({
        subject: 'user',
        action: 'delete',
        type: 'cannot',
      });
    });

    it('should return permission object when passed permission object directly', () => {
      const existingPermission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: { userId: '123' },
        scope: 'tenant:123' as ScopeString,
      };

      const result = permission(existingPermission);

      expect(result).toBe(existingPermission);
      expect(result).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: { userId: '123' },
        scope: 'tenant:123',
      });
    });
  });

  describe('subject/action overload detection', () => {
    it('should detect subject/action overload and default type to "can"', () => {
      // Test: permission[S](action) - should default type to 'can'
      const result = permission.user('read');

      expect(result).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
      });
    });

    it('should detect subject/action overload with conditions', () => {
      // Test: permission[S](action, conditions) - should default type to 'can'
      const conditions: ConditionsQuery = { userId: '123' };
      const result = permission.user('read', undefined, conditions);

      expect(result).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions,
      });
    });

    it('should detect subject/action overload with conditions and scope', () => {
      // Test: permission[S](action, conditions, scope) - should default type to 'can'
      const conditions = { userId: '123' };
      const scope = 'tenant:123' as ScopeString;
      const result = permission.user('read', undefined, conditions, scope);

      expect(result).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions,
        scope,
      });
    });

    it('should detect full overload when type is explicitly provided', () => {
      // Test: permission[S](action, type, conditions?, scope?)
      const conditions = { userId: '123' };
      const scope = 'tenant:123' as ScopeString;
      const result = permission.user('read', 'cannot', conditions, scope);

      expect(result).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'cannot',
        conditions,
        scope,
      });
    });

    it('should detect full overload with just action and type', () => {
      // Test: permission[S](action, type)
      const result = permission.user('read', 'cannot');

      expect(result).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'cannot',
      });
    });

    it('should work with all subjects for overload detection', () => {
      // Test all subjects with subject/action overload
      expect(permission.all('read')).toStrictEqual({
        subject: 'all',
        action: 'read',
        type: 'can',
      });

      expect(permission.org('manage')).toStrictEqual({
        subject: 'org',
        action: 'manage',
        type: 'can',
      });

      expect(permission.app('assign')).toStrictEqual({
        subject: 'app',
        action: 'assign',
        type: 'can',
      });

      expect(permission.role('unassign')).toStrictEqual({
        subject: 'role',
        action: 'unassign',
        type: 'can',
      });

      expect(permission.user('invite')).toStrictEqual({
        subject: 'user',
        action: 'invite',
        type: 'can',
      });
    });

    it('should handle array actions in subject/action overload', () => {
      // Test: permission[S](action[], conditions?, scope?)
      const conditions = { userId: '123' };
      const result = permission.user(['read', 'create'], undefined, conditions);

      expect(result).toStrictEqual({
        subject: 'user',
        action: ['read', 'create'],
        type: 'can',
        conditions,
      });
    });

    it('should preserve explicit type when conditions are not ActionType', () => {
      // Test edge case: conditions that might be confused with ActionType
      const conditions = { $or: [{ role: 'admin' }, { role: 'manager' }] };
      const result = permission.user('read', undefined, conditions);

      expect(result).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions,
      });
    });

    it('should handle scope-only in subject/action overload', () => {
      // Test: permission[S](action, undefined, scope)
      const scope = 'tenant:123' as ScopeString;
      const result = permission.user('read', undefined, undefined, scope);

      expect(result).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
        scope,
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when subject is undefined', () => {
      expect(() => {
        permission(undefined as unknown as Subject, 'read', 'can');
      }).toThrow('Subject is required');
    });

    it('should throw error when action is undefined', () => {
      expect(() => {
        permission('user', undefined as unknown as Action<'user'>, 'can');
      }).toThrow('Action is required');
    });

    it('should not throw error when type is undefined', () => {
      expect(() => {
        permission('user', 'read', undefined as unknown as ActionType);
      }).not.toThrow();
    });

    it('should throw error when both action and type are undefined', () => {
      expect(() => {
        permission(
          'user',
          undefined as unknown as Action<'user'>,
          undefined as unknown as ActionType,
        );
      }).toThrow('Action is required');
    });
  });

  describe('type safety', () => {
    it('should maintain type safety for subject and action combinations', () => {
      // These should compile without type errors
      const userPermission = permission('user', 'read', 'can');
      const orgPermission = permission('org', 'manage', 'can');
      const appPermission = permission('app', 'assign', 'can');
      const rolePermission = permission('role', 'unassign', 'can');
      const allPermission = permission('all', 'create', 'can');

      expect(userPermission.subject).toBe('user');
      expect(orgPermission.subject).toBe('org');
      expect(appPermission.subject).toBe('app');
      expect(rolePermission.subject).toBe('role');
      expect(allPermission.subject).toBe('all');
    });

    it('should work with array subjects and actions', () => {
      const multiPermission = permission(
        ['user', 'org'] as Subject[],
        ['read', 'create'] as Action<'user' | 'org'>[],
        'can',
      );

      expect(multiPermission.subject).toStrictEqual(['user', 'org']);
      expect(multiPermission.action).toStrictEqual(['read', 'create']);
      expect(multiPermission.type).toBe('can');
    });
  });

  describe('edge cases', () => {
    it('should handle empty arrays for subject and action', () => {
      const result = permission([], [], 'can');

      expect(result).toStrictEqual({
        subject: [],
        action: [],
        type: 'can',
      });
    });

    it('should handle null/undefined conditions gracefully', () => {
      const result = permission('user', 'read', 'can', undefined, undefined);

      expect(result).toStrictEqual({
        subject: 'user',
        action: 'read',
        type: 'can',
      });
    });

    it('should handle complex conditions object', () => {
      const complexConditions = {
        $and: [
          { userId: '123' },
          { tenantId: '456' },
          { $or: [{ role: 'admin' }, { role: 'manager' }] },
        ],
      };

      const result = permission('user', 'read', 'can', complexConditions);

      expect(result.conditions).toStrictEqual(complexConditions);
    });
  });

  describe('integration with permission types', () => {
    it('should create permissions compatible with Permission interface', () => {
      const userReadPermission = permission('user', 'read', 'can');

      // Should satisfy Permission interface
      const permissionInterface: Permission<'user', 'read', 'can'> = userReadPermission;

      expect(permissionInterface.subject).toBe('user');
      expect(permissionInterface.action).toBe('read');
      expect(permissionInterface.type).toBe('can');
    });

    it('should work with different action types', () => {
      const canPermission = permission('user', 'read', 'can');
      const cannotPermission = permission('user', 'delete', 'cannot');

      expect(canPermission.type).toBe('can');
      expect(cannotPermission.type).toBe('cannot');
    });
  });
});
