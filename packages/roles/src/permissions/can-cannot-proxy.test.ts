import { describe, it, expect } from 'vitest';

import { ScopeString } from '../scope';

import { can, cannot } from './can-cannot-proxy';
import { permission } from './permission-proxy';
import { stringifyPermission } from './stringify-permission';
import { Permission, Subject, Action } from './types';

describe('can-cannot-proxy', () => {
  describe('can proxy', () => {
    describe('proxy property access', () => {
      it('should return permission object when accessing action.subject', () => {
        const userReadPermission = can.read.user;
        const orgManagePermission = can.manage.org;
        const appAssignPermission = can.assign.app;

        expect(userReadPermission).toBeDefined();
        expect(orgManagePermission).toBeDefined();
        expect(appAssignPermission).toBeDefined();
      });

      it('should create permission with type "can" when accessing action.subject', () => {
        const userReadPermission = can.read.user;
        const orgManagePermission = can.manage.org;

        expect(stringifyPermission(userReadPermission)).toBe('user:read');
        expect(stringifyPermission(orgManagePermission)).toBe('org:manage');
      });

      it('should work with all defined subjects and actions', () => {
        // Test all subjects
        expect(stringifyPermission(can.read.all)).toBe('all:read');
        expect(stringifyPermission(can.create.all)).toBe('all:create');
        expect(stringifyPermission(can.update.all)).toBe('all:update');
        expect(stringifyPermission(can.delete.all)).toBe('all:delete');
        expect(stringifyPermission(can.manage.all)).toBe('all:manage');

        expect(stringifyPermission(can.read.org)).toBe('org:read');
        expect(stringifyPermission(can.create.org)).toBe('org:create');
        expect(stringifyPermission(can.update.org)).toBe('org:update');
        expect(stringifyPermission(can.delete.org)).toBe('org:delete');
        expect(stringifyPermission(can.manage.org)).toBe('org:manage');

        expect(stringifyPermission(can.read.app)).toBe('app:read');
        expect(stringifyPermission(can.create.app)).toBe('app:create');
        expect(stringifyPermission(can.update.app)).toBe('app:update');
        expect(stringifyPermission(can.delete.app)).toBe('app:delete');
        expect(stringifyPermission(can.manage.app)).toBe('app:manage');
        expect(stringifyPermission(can.assign.app)).toBe('app:assign');
        expect(stringifyPermission(can.unassign.app)).toBe('app:unassign');

        expect(stringifyPermission(can.read.role)).toBe('role:read');
        expect(stringifyPermission(can.create.role)).toBe('role:create');
        expect(stringifyPermission(can.update.role)).toBe('role:update');
        expect(stringifyPermission(can.delete.role)).toBe('role:delete');
        expect(stringifyPermission(can.manage.role)).toBe('role:manage');
        expect(stringifyPermission(can.assign.role)).toBe('role:assign');
        expect(stringifyPermission(can.unassign.role)).toBe('role:unassign');

        expect(stringifyPermission(can.read.user)).toBe('user:read');
        expect(stringifyPermission(can.create.user)).toBe('user:create');
        expect(stringifyPermission(can.update.user)).toBe('user:update');
        expect(stringifyPermission(can.delete.user)).toBe('user:delete');
        expect(stringifyPermission(can.manage.user)).toBe('user:manage');
        expect(stringifyPermission(can.invite.user)).toBe('user:invite');
        expect(stringifyPermission(can.remove.user)).toBe('user:remove');
      });
    });

    describe('proxy function calls', () => {
      it('should create permission object when called as function with subject and context', () => {
        const userReadPermission = can.read('user', { userId: '123' });
        const orgManagePermission = can.manage('org', { orgId: '456' });

        expect(userReadPermission).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'can',
          conditions: { userId: '123' },
        });

        expect(orgManagePermission).toStrictEqual({
          subject: 'org',
          action: 'manage',
          type: 'can',
          conditions: { orgId: '456' },
        });
      });

      it('should create permission object with arrays for subject and action', () => {
        const result = can.read(['user', 'org'], { userId: '123' });

        expect(result).toStrictEqual({
          subject: ['user', 'org'],
          action: 'read',
          type: 'can',
          conditions: { userId: '123' },
        });
      });

      it('should create permission object with conditions and scope when called as function', () => {
        const conditions = { userId: '123' };
        const scope = 'app:123' as ScopeString;

        // This tests the proxy's apply trap
        const result = can.read('user', conditions, scope);

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'can',
          conditions,
          scope,
        });
      });
    });
  });

  describe('cannot proxy', () => {
    describe('proxy property access', () => {
      it('should return permission object when accessing action.subject', () => {
        const userReadPermission = cannot.read.user;
        const orgManagePermission = cannot.manage.org;
        const appAssignPermission = cannot.assign.app;

        expect(userReadPermission).toBeDefined();
        expect(orgManagePermission).toBeDefined();
        expect(appAssignPermission).toBeDefined();
      });

      it('should create permission with type "cannot" when accessing action.subject', () => {
        const userReadPermission = cannot.read.user;
        const orgManagePermission = cannot.manage.org;

        expect(stringifyPermission(userReadPermission)).toBe('!user:read');
        expect(stringifyPermission(orgManagePermission)).toBe('!org:manage');
      });

      it('should work with all defined subjects and actions', () => {
        // Test all subjects
        expect(stringifyPermission(cannot.read.all)).toBe('!all:read');
        expect(stringifyPermission(cannot.create.all)).toBe('!all:create');
        expect(stringifyPermission(cannot.update.all)).toBe('!all:update');
        expect(stringifyPermission(cannot.delete.all)).toBe('!all:delete');
        expect(stringifyPermission(cannot.manage.all)).toBe('!all:manage');

        expect(stringifyPermission(cannot.read.org)).toBe('!org:read');
        expect(stringifyPermission(cannot.create.org)).toBe('!org:create');
        expect(stringifyPermission(cannot.update.org)).toBe('!org:update');
        expect(stringifyPermission(cannot.delete.org)).toBe('!org:delete');
        expect(stringifyPermission(cannot.manage.org)).toBe('!org:manage');

        expect(stringifyPermission(cannot.read.app)).toBe('!app:read');
        expect(stringifyPermission(cannot.create.app)).toBe('!app:create');
        expect(stringifyPermission(cannot.update.app)).toBe('!app:update');
        expect(stringifyPermission(cannot.delete.app)).toBe('!app:delete');
        expect(stringifyPermission(cannot.manage.app)).toBe('!app:manage');
        expect(stringifyPermission(cannot.assign.app)).toBe('!app:assign');
        expect(stringifyPermission(cannot.unassign.app)).toBe('!app:unassign');

        expect(stringifyPermission(cannot.read.role)).toBe('!role:read');
        expect(stringifyPermission(cannot.create.role)).toBe('!role:create');
        expect(stringifyPermission(cannot.update.role)).toBe('!role:update');
        expect(stringifyPermission(cannot.delete.role)).toBe('!role:delete');
        expect(stringifyPermission(cannot.manage.role)).toBe('!role:manage');
        expect(stringifyPermission(cannot.assign.role)).toBe('!role:assign');
        expect(stringifyPermission(cannot.unassign.role)).toBe('!role:unassign');

        expect(stringifyPermission(cannot.read.user)).toBe('!user:read');
        expect(stringifyPermission(cannot.create.user)).toBe('!user:create');
        expect(stringifyPermission(cannot.update.user)).toBe('!user:update');
        expect(stringifyPermission(cannot.delete.user)).toBe('!user:delete');
        expect(stringifyPermission(cannot.manage.user)).toBe('!user:manage');
        expect(stringifyPermission(cannot.invite.user)).toBe('!user:invite');
        expect(stringifyPermission(cannot.remove.user)).toBe('!user:remove');
      });
    });

    describe('proxy function calls', () => {
      it('should create permission object when called as function with subject and context', () => {
        const userReadPermission = cannot.read('user', { userId: '123' });
        const orgManagePermission = cannot.manage('org', { orgId: '456' });

        expect(userReadPermission).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'cannot',
          conditions: { userId: '123' },
        });

        expect(orgManagePermission).toStrictEqual({
          subject: 'org',
          action: 'manage',
          type: 'cannot',
          conditions: { orgId: '456' },
        });
      });

      it('should create permission object with arrays for subject and action', () => {
        const result = cannot.read(['user', 'org'], { userId: '123' });

        expect(result).toStrictEqual({
          subject: ['user', 'org'],
          action: 'read',
          type: 'cannot',
          conditions: { userId: '123' },
        });
      });

      it('should create permission object with conditions and scope when called as function', () => {
        const conditions = { userId: '123' };
        const scope = 'app:123' as ScopeString;

        // This tests the proxy's apply trap
        const result = cannot.read('user', conditions, scope);

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'cannot',
          conditions,
          scope,
        });
      });
    });
  });

  describe('proxy behavior', () => {
    it('should handle dynamic property access', () => {
      const subjects: Subject[] = ['user', 'org', 'app', 'role', 'all'];
      const actions: Action<'user'>[] = ['read', 'create', 'update', 'delete', 'manage'];

      subjects.forEach((subject) => {
        if (subject === 'user') {
          actions.forEach((action) => {
            const canPermission = can[action][subject];
            const cannotPermission = cannot[action][subject];

            expect(canPermission).toBeDefined();
            expect(cannotPermission).toBeDefined();
          });
        }
      });
    });

    it('should maintain separate instances for can and cannot', () => {
      const userReadCan = can.read.user;
      const userReadCannot = cannot.read.user;

      expect(userReadCan).not.toBe(userReadCannot);
      expect(stringifyPermission(userReadCan)).toBe('user:read');
      expect(stringifyPermission(userReadCannot)).toBe('!user:read');
    });

    it('should handle function calls with different signatures', () => {
      // Test the proxy's apply trap
      const canResult = can.read('user', { userId: '123' }, 'app:123' as ScopeString);
      const cannotResult = cannot.read('user', { userId: '123' }, 'app:123' as ScopeString);

      expect(canResult.type).toBe('can');
      expect(cannotResult.type).toBe('cannot');
      expect(canResult.conditions).toStrictEqual({ userId: '123' });
      expect(cannotResult.conditions).toStrictEqual({ userId: '123' });
      expect(canResult.scope).toBe('app:123');
      expect(cannotResult.scope).toBe('app:123');
    });
  });

  describe('proxy behavior with null', () => {
    it('should handle dynamic property access', () => {
      const subjects: Subject[] = ['user', 'org', 'app', 'role', 'all'];
      const actions: Action<'user'>[] = ['read', 'create', 'update', 'delete', 'manage'];

      subjects.forEach((subject) => {
        if (subject === 'user') {
          actions.forEach((action) => {
            const canPermission = can[action][subject];
            const cannotPermission = cannot[action][subject];

            expect(canPermission).toBeDefined();
            expect(cannotPermission).toBeDefined();
          });
        }
      });
    });

    it('should maintain separate instances for can and cannot', () => {
      const userReadCan = can.read.user;
      const userReadCannot = cannot.read.user;

      expect(userReadCan).not.toBe(userReadCannot);
      expect(stringifyPermission(userReadCan)).toBe('user:read');
      expect(stringifyPermission(userReadCannot)).toBe('!user:read');
    });

    it('should handle function calls with different signatures', () => {
      // Test the proxy's apply trap
      const canResult = can.read('user', { userId: '123' }, 'app:123' as ScopeString);
      const cannotResult = cannot.read('user', { userId: '123' }, 'app:123' as ScopeString);

      expect(canResult.type).toBe('can');
      expect(cannotResult.type).toBe('cannot');
      expect(canResult.conditions).toStrictEqual({ userId: '123' });
      expect(cannotResult.conditions).toStrictEqual({ userId: '123' });
      expect(canResult.scope).toBe('app:123');
      expect(cannotResult.scope).toBe('app:123');
    });
  });

  describe('proxy apply trap overload detection', () => {
    describe('can proxy apply trap', () => {
      it('should detect action-subject overload and preserve type "can"', () => {
        // Test: can(action, subject) - should preserve type 'can'
        const result = can('read', 'user');

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'can',
        });
      });

      it('should detect action-subject overload with conditions', () => {
        // Test: can(action, subject, conditions) - should preserve type 'can'
        const conditions = { userId: '123' };
        const result = can('read', 'user', conditions);

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'can',
          conditions,
        });
      });

      it('should detect action-subject overload with conditions and scope', () => {
        // Test: can(action, subject, conditions, scope) - should preserve type 'can'
        const conditions = { userId: '123' };
        const scope = 'app:123' as ScopeString;
        const result = can('read', 'user', conditions, scope);

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'can',
          conditions,
          scope,
        });
      });

      it('should work with array actions and subjects in overload', () => {
        // Test: can(action[], subject[]) - should preserve type 'can'
        const result = can(['read', 'create'], ['user', 'org']);

        expect(result).toStrictEqual({
          subject: ['user', 'org'],
          action: ['read', 'create'],
          type: 'can',
        });
      });

      it('should work with array actions, single subject, and conditions in overload', () => {
        // Test: can(action[], subject, conditions) - should preserve type 'can'
        const conditions = { userId: '123' };
        const result = can(['read', 'create'], 'user', conditions);

        expect(result).toStrictEqual({
          subject: 'user',
          action: ['read', 'create'],
          type: 'can',
          conditions,
        });
      });

      it('should work with single action, array subjects, and scope in overload', () => {
        // Test: can(action, subject[], undefined, scope) - should preserve type 'can'
        const scope = 'org:123' as ScopeString;
        const result = can('read', ['user', 'org'], undefined, scope);

        expect(result).toStrictEqual({
          subject: ['user', 'org'],
          action: 'read',
          type: 'can',
          scope,
        });
      });

      it('should work with all action types in overload', () => {
        const actions: Action[] = ['read', 'create', 'update', 'delete', 'manage'];
        const subjects: Subject[] = [
          'user',
          'org',
          'app',
          'role',
          'all',
          'webhook',
          'webhookSecret',
          'webhookSubscription',
        ];

        actions.forEach((action) => {
          subjects.forEach((subject) => {
            if (action === 'assign' || action === 'unassign') {
              // These actions only work with app and role subjects
              if (subject === 'app' || subject === 'role') {
                const result = can(action, subject);
                expect(result.action).toBe(action);
                expect(result.subject).toBe(subject);
                expect(result.type).toBe('can');
              }
            } else if (action === 'invite' || action === 'remove') {
              // These actions only work with user subject
              if (subject === 'user') {
                const result = can(action, subject);
                expect(result.action).toBe(action);
                expect(result.subject).toBe(subject);
                expect(result.type).toBe('can');
              }
            } else if (action === 'refresh') {
              // This action only works with webhookSecret subject
              if (subject === 'webhookSecret') {
                const result = can(action, subject);
                expect(result.action).toBe(action);
                expect(result.subject).toBe(subject);
                expect(result.type).toBe('can');
              }
            } else {
              // Standard actions work with all subjects
              const result = can(action, subject);
              expect(result.action).toBe(action);
              expect(result.subject).toBe(subject);
              expect(result.type).toBe('can');
            }
          });
        });
      });
    });

    describe('cannot proxy apply trap', () => {
      it('should detect action-subject overload and preserve type "cannot"', () => {
        // Test: cannot(action, subject) - should preserve type 'cannot'
        const result = cannot('read', 'user');

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'cannot',
        });
      });

      it('should detect action-subject overload with conditions', () => {
        // Test: cannot(action, subject, conditions) - should preserve type 'cannot'
        const conditions = { userId: '123' };
        const result = cannot('read', 'user', conditions);

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'cannot',
          conditions,
        });
      });

      it('should detect action-subject overload with conditions and scope', () => {
        // Test: cannot(action, subject, conditions, scope) - should preserve type 'cannot'
        const conditions = { userId: '123' };
        const scope = 'app:123' as ScopeString;
        const result = cannot('read', 'user', conditions, scope);

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'cannot',
          conditions,
          scope,
        });
      });

      it('should work with array actions and subjects in overload', () => {
        // Test: cannot(action[], subject[]) - should preserve type 'cannot'
        const result = cannot(['read', 'create'], ['user', 'org']);

        expect(result).toStrictEqual({
          subject: ['user', 'org'],
          action: ['read', 'create'],
          type: 'cannot',
        });
      });

      it('should work with array actions, single subject, and conditions in overload', () => {
        // Test: cannot(action[], subject, conditions) - should preserve type 'cannot'
        const conditions = { userId: '123' };
        const result = cannot(['read', 'create'], 'user', conditions);

        expect(result).toStrictEqual({
          subject: 'user',
          action: ['read', 'create'],
          type: 'cannot',
          conditions,
        });
      });

      it('should work with single action, array subjects, and scope in overload', () => {
        // Test: cannot(action, subject[], undefined, scope) - should preserve type 'cannot'
        const scope = 'org:123' as ScopeString;
        const result = cannot('read', ['user', 'org'], undefined, scope);

        expect(result).toStrictEqual({
          subject: ['user', 'org'],
          action: 'read',
          type: 'cannot',
          scope,
        });
      });

      it('should work with all action types in overload', () => {
        const actions: Action[] = ['read', 'create', 'update', 'delete', 'manage'];
        const subjects: Subject[] = [
          'user',
          'org',
          'app',
          'role',
          'all',
          'webhook',
          'webhookSecret',
          'webhookSubscription',
        ];

        actions.forEach((action) => {
          subjects.forEach((subject) => {
            if (action === 'assign' || action === 'unassign') {
              // These actions only work with app and role subjects
              if (subject === 'app' || subject === 'role') {
                const result = cannot(action, subject);
                expect(result.action).toBe(action);
                expect(result.subject).toBe(subject);
                expect(result.type).toBe('cannot');
              }
            } else if (action === 'invite' || action === 'remove') {
              // These actions only work with user subject
              if (subject === 'user') {
                const result = cannot(action, subject);
                expect(result.action).toBe(action);
                expect(result.subject).toBe(subject);
                expect(result.type).toBe('cannot');
              }
            } else if (action === 'refresh') {
              // This action only works with webhookSecret subject
              if (subject === 'webhookSecret') {
                const result = cannot(action, subject);
                expect(result.action).toBe(action);
                expect(result.subject).toBe(subject);
                expect(result.type).toBe('cannot');
              }
            } else {
              // Standard actions work with all subjects
              const result = cannot(action, subject);
              expect(result.action).toBe(action);
              expect(result.subject).toBe(subject);
              expect(result.type).toBe('cannot');
            }
          });
        });
      });
    });

    describe('overload detection edge cases', () => {
      it('should handle conditions that might be confused with ActionType', () => {
        // Test edge case: conditions that might be confused with ActionType
        const conditions = { $or: [{ role: 'admin' }, { role: 'manager' }] };
        const result = can('read', 'user', conditions);

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'can',
          conditions,
        });
      });

      it('should handle scope-only in action-subject overload', () => {
        // Test: can(action, subject, undefined, scope)
        const scope = 'org:123' as ScopeString;
        const result = can('read', 'user', undefined, scope);

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'can',
          scope,
        });
      });

      it('should handle undefined conditions gracefully in overload', () => {
        const result = can('read', 'user', undefined, 'app:123');

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'can',
          scope: 'app:123',
        });
      });

      it('should handle undefined scope gracefully in overload', () => {
        const conditions = { userId: '123' };
        const result = can('read', 'user', conditions, undefined);

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'can',
          conditions,
        });
      });

      it('should handle empty arrays for actions and subjects in overload', () => {
        const result = can([], []);

        expect(result).toStrictEqual({
          subject: [],
          action: [],
          type: 'can',
        });
      });

      it('should handle mixed array and single values in overload', () => {
        const result = can('read', ['user', 'org']);

        expect(result).toStrictEqual({
          subject: ['user', 'org'],
          action: 'read',
          type: 'can',
        });
      });
    });

    describe('type preservation validation', () => {
      it('should always preserve "can" type for can proxy regardless of argument order', () => {
        const testCases = [
          {
            args: ['read', 'user'],
            expected: { action: 'read', subject: 'user', type: 'can' },
          },
          {
            args: ['read', 'user', { userId: '123' }],
            expected: { action: 'read', subject: 'user', type: 'can' },
          },
          {
            args: ['read', 'user', { userId: '123' }, 'app:123'],
            expected: { action: 'read', subject: 'user', type: 'can' },
          },
          {
            args: [
              ['read', 'create'],
              ['user', 'org'],
            ],
            expected: {
              action: ['read', 'create'],
              subject: ['user', 'org'],
              type: 'can',
            },
          },
        ] as const;

        testCases.forEach(({ args, expected }) => {
          // @ts-expect-error - this fails type assertions for some reason
          const result = can(...args);
          expect(result.type).toBe(expected.type);
          expect(result.action).toStrictEqual(expected.action);
          expect(result.subject).toStrictEqual(expected.subject);
        });
      });

      it('should always preserve "cannot" type for cannot proxy regardless of argument order', () => {
        const testCases = [
          {
            args: ['read', 'user'],
            expected: { action: 'read', subject: 'user', type: 'cannot' },
          },
          {
            args: ['read', 'user', { userId: '123' }],
            expected: { action: 'read', subject: 'user', type: 'cannot' },
          },
          {
            args: ['read', 'user', { userId: '123' }, 'app:123'],
            expected: { action: 'read', subject: 'user', type: 'cannot' },
          },
          {
            args: [
              ['read', 'create'],
              ['user', 'org'],
            ],
            expected: {
              action: ['read', 'create'],
              subject: ['user', 'org'],
              type: 'cannot',
            },
          },
        ];

        testCases.forEach(({ args, expected }) => {
          // @ts-expect-error - this fails type assertions for some reason
          const result = cannot(...args);
          expect(result.type).toBe(expected.type);
          expect(result.action).toStrictEqual(expected.action);
          expect(result.subject).toStrictEqual(expected.subject);
        });
      });
    });
  });

  describe('type safety', () => {
    it('should maintain type safety for subject and action combinations', () => {
      // These should compile without type errors
      const userCanPermission = can.read.user;
      const orgCanPermission = can.manage.org;
      const appCanPermission = can.assign.app;
      const roleCanPermission = can.unassign.role;
      const allCanPermission = can.create.all;

      const userCannotPermission = cannot.read.user;
      const orgCannotPermission = cannot.manage.org;
      const appCannotPermission = cannot.assign.app;
      const roleCannotPermission = cannot.unassign.role;
      const allCannotPermission = cannot.create.all;

      expect(userCanPermission.subject).toBe('user');
      expect(orgCanPermission.subject).toBe('org');
      expect(appCanPermission.subject).toBe('app');
      expect(roleCanPermission.subject).toBe('role');
      expect(allCanPermission.subject).toBe('all');

      expect(userCannotPermission.subject).toBe('user');
      expect(orgCannotPermission.subject).toBe('org');
      expect(appCannotPermission.subject).toBe('app');
      expect(roleCannotPermission.subject).toBe('role');
      expect(allCannotPermission.subject).toBe('all');
    });

    it('should work with array subjects and actions', () => {
      const multiCanPermission = can.read(['user', 'org'], { userId: '123' });
      const multiCannotPermission = cannot.read(['user', 'org'], {
        userId: '123',
      });

      expect(multiCanPermission.subject).toStrictEqual(['user', 'org']);
      expect(multiCanPermission.action).toBe('read');
      expect(multiCanPermission.type).toBe('can');

      expect(multiCannotPermission.subject).toStrictEqual(['user', 'org']);
      expect(multiCannotPermission.action).toBe('read');
      expect(multiCannotPermission.type).toBe('cannot');
    });
  });

  describe('integration with permission system', () => {
    it('should create permissions compatible with Permission interface', () => {
      const userReadCanPermission = can.read.user;
      const userReadCannotPermission = cannot.read.user;

      // Should satisfy Permission interface
      const canPermissionInterface: Permission<'user', 'read', 'can'> = userReadCanPermission;
      const cannotPermissionInterface: Permission<'user', 'read', 'cannot'> =
        userReadCannotPermission;

      expect(canPermissionInterface.subject).toBe('user');
      expect(canPermissionInterface.action).toBe('read');
      expect(canPermissionInterface.type).toBe('can');

      expect(cannotPermissionInterface.subject).toBe('user');
      expect(cannotPermissionInterface.action).toBe('read');
      expect(cannotPermissionInterface.type).toBe('cannot');
    });

    it('should work with permission stringification', () => {
      const userReadCan = can.read.user;
      const userReadCannot = cannot.read.user;

      expect(stringifyPermission(userReadCan)).toBe('user:read');
      expect(stringifyPermission(userReadCannot)).toBe('!user:read');
    });

    it('should integrate with the permission proxy', () => {
      // Both can and cannot should use the same underlying permission function
      const canPermission = can.read.user;
      const cannotPermission = cannot.read.user;
      const directPermission = permission.user.read;

      expect(canPermission).toBeDefined();
      expect(cannotPermission).toBeDefined();
      expect(directPermission).toBeDefined();

      // The can permission should have type 'can' (default)
      // The cannot permission should have type 'cannot'
      expect(canPermission.type).toBe('can');
      expect(cannotPermission.type).toBe('cannot');
    });
  });

  describe('base method calls', () => {
    describe('can() method', () => {
      it('should create permission when called directly with action and subject', () => {
        const result = can('read', 'user');

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'can',
        });
      });

      it('should create permission when called directly with action, subject, and conditions', () => {
        const conditions = { userId: '123' };
        const result = can('read', 'user', conditions);

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'can',
          conditions,
        });
      });

      it('should create permission when called directly with action, subject, conditions, and scope', () => {
        const conditions = { userId: '123' };
        const scope = 'app:123' as ScopeString;
        const result = can('read', 'user', conditions, scope);

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'can',
          conditions,
          scope,
        });
      });

      it('should work with array actions and subjects', () => {
        const result = can(['read', 'create'], ['user', 'org']);

        expect(result).toStrictEqual({
          subject: ['user', 'org'],
          action: ['read', 'create'],
          type: 'can',
        });
      });

      it('should work with array actions, single subject, and conditions', () => {
        const conditions = { userId: '123' };
        const result = can(['read', 'create'], 'user', conditions);

        expect(result).toStrictEqual({
          subject: 'user',
          action: ['read', 'create'],
          type: 'can',
          conditions,
        });
      });

      it('should work with single action, array subjects, and scope', () => {
        const scope = 'org:123' as ScopeString;
        const result = can('read', ['user', 'org'], undefined, scope);

        expect(result).toStrictEqual({
          subject: ['user', 'org'],
          action: 'read',
          type: 'can',
          scope,
        });
      });

      it('should work with all action types', () => {
        const actions: Action[] = ['read', 'create', 'update', 'delete', 'manage'];
        const subjects: Subject[] = [
          'user',
          'org',
          'app',
          'role',
          'all',
          'webhook',
          'webhookSecret',
          'webhookSubscription',
        ];

        actions.forEach((action) => {
          subjects.forEach((subject) => {
            if (action === 'assign' || action === 'unassign') {
              // These actions only work with app and role subjects
              if (subject === 'app' || subject === 'role') {
                const result = can(action, subject);
                expect(result.action).toBe(action);
                expect(result.subject).toBe(subject);
                expect(result.type).toBe('can');
              }
            } else if (action === 'invite' || action === 'remove') {
              // These actions only work with user subject
              if (subject === 'user') {
                const result = can(action, subject);
                expect(result.action).toBe(action);
                expect(result.subject).toBe(subject);
                expect(result.type).toBe('can');
              }
            } else if (action === 'refresh') {
              // This action only works with webhookSecret subject
              if (subject === 'webhookSecret') {
                const result = can(action, subject);
                expect(result.action).toBe(action);
                expect(result.subject).toBe(subject);
                expect(result.type).toBe('cannot');
              }
            } else {
              // Standard actions work with all subjects
              const result = can(action, subject);
              expect(result.action).toBe(action);
              expect(result.subject).toBe(subject);
              expect(result.type).toBe('can');
            }
          });
        });
      });
    });

    describe('cannot() method', () => {
      it('should create permission when called directly with action and subject', () => {
        const result = cannot('read', 'user');

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'cannot',
        });
      });

      it('should create permission when called directly with action, subject, and conditions', () => {
        const conditions = { userId: '123' };
        const result = cannot('read', 'user', conditions);

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'cannot',
          conditions,
        });
      });

      it('should create permission when called directly with action, subject, conditions, and scope', () => {
        const conditions = { userId: '123' };
        const scope = 'app:123' as ScopeString;
        const result = cannot('read', 'user', conditions, scope);

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'cannot',
          conditions,
          scope,
        });
      });

      it('should work with array actions and subjects', () => {
        const result = cannot(['read', 'create'], ['user', 'org']);

        expect(result).toStrictEqual({
          subject: ['user', 'org'],
          action: ['read', 'create'],
          type: 'cannot',
        });
      });

      it('should work with array actions, single subject, and conditions', () => {
        const conditions = { userId: '123' };
        const result = cannot(['read', 'create'], 'user', conditions);

        expect(result).toStrictEqual({
          subject: 'user',
          action: ['read', 'create'],
          type: 'cannot',
          conditions,
        });
      });

      it('should work with single action, array subjects, and scope', () => {
        const scope = 'org:123' as ScopeString;
        const result = cannot('read', ['user', 'org'], undefined, scope);

        expect(result).toStrictEqual({
          subject: ['user', 'org'],
          action: 'read',
          type: 'cannot',
          scope,
        });
      });

      it('should work with all action types', () => {
        const actions: Action[] = ['read', 'create', 'update', 'delete', 'manage'];
        const subjects: Subject[] = ['user', 'org', 'app', 'role', 'all'];

        actions.forEach((action) => {
          subjects.forEach((subject) => {
            if (action === 'assign' || action === 'unassign') {
              // These actions only work with app and role subjects
              if (subject === 'app' || subject === 'role') {
                const result = cannot(action, subject);
                expect(result.action).toBe(action);
                expect(result.subject).toBe(subject);
                expect(result.type).toBe('cannot');
              }
            } else if (action === 'invite' || action === 'remove') {
              // These actions only work with user subject
              if (subject === 'user') {
                const result = cannot(action, subject);
                expect(result.action).toBe(action);
                expect(result.subject).toBe(subject);
                expect(result.type).toBe('cannot');
              }
            } else if (action === 'refresh') {
              // This action only works with webhookSecret subject
              if (subject === 'webhookSecret') {
                const result = cannot(action, subject);
                expect(result.action).toBe(action);
                expect(result.subject).toBe(subject);
                expect(result.type).toBe('cannot');
              }
            } else {
              // Standard actions work with all subjects
              const result = cannot(action, subject);
              expect(result.action).toBe(action);
              expect(result.subject).toBe(subject);
              expect(result.type).toBe('cannot');
            }
          });
        });
      });
    });

    describe('comparison between can() and cannot()', () => {
      it('should create different permission types for same action and subject', () => {
        const canPermission = can('read', 'user');
        const cannotPermission = cannot('read', 'user');

        expect(canPermission.type).toBe('can');
        expect(cannotPermission.type).toBe('cannot');
        expect(canPermission.action).toBe('read');
        expect(cannotPermission.action).toBe('read');
        expect(canPermission.subject).toBe('user');
        expect(cannotPermission.subject).toBe('user');
      });

      it('should stringify correctly for both types', () => {
        const canPermission = can('read', 'user');
        const cannotPermission = cannot('read', 'user');

        expect(stringifyPermission(canPermission)).toBe('user:read');
        expect(stringifyPermission(cannotPermission)).toBe('!user:read');
      });

      it('should handle complex conditions consistently', () => {
        const complexConditions = {
          $and: [
            { userId: '123' },
            { appId: '456' },
            { $or: [{ role: 'admin' }, { role: 'manager' }] },
          ],
        };

        const canResult = can('read', 'user', complexConditions, 'app:123');
        const cannotResult = cannot('read', 'user', complexConditions, 'app:123');

        expect(canResult.conditions).toStrictEqual(complexConditions);
        expect(cannotResult.conditions).toStrictEqual(complexConditions);
        expect(canResult.scope).toBe('app:123');
        expect(cannotResult.scope).toBe('app:123');
        expect(canResult.type).toBe('can');
        expect(cannotResult.type).toBe('cannot');
      });
    });

    describe('edge cases for base method calls', () => {
      it('should handle undefined conditions gracefully', () => {
        const result = can('read', 'user', undefined, 'app:123');

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'can',
          scope: 'app:123',
        });
      });

      it('should handle undefined scope gracefully', () => {
        const conditions = { userId: '123' };
        const result = can('read', 'user', conditions, undefined);

        expect(result).toStrictEqual({
          subject: 'user',
          action: 'read',
          type: 'can',
          conditions,
        });
      });

      it('should handle empty arrays for actions and subjects', () => {
        const result = can([], []);

        expect(result).toStrictEqual({
          subject: [],
          action: [],
          type: 'can',
        });
      });

      it('should handle mixed array and single values', () => {
        const result = can('read', ['user', 'org']);

        expect(result).toStrictEqual({
          subject: ['user', 'org'],
          action: 'read',
          type: 'can',
        });
      });
    });
  });

  describe('edge cases', () => {
    it('should handle undefined conditions and scope gracefully', () => {
      const canPermission = can.read('user', { userId: '123' });
      const cannotPermission = cannot.read('user', { userId: '123' });

      expect(canPermission.conditions).toStrictEqual({ userId: '123' });
      expect(canPermission.scope).toBeUndefined();
      expect(cannotPermission.conditions).toStrictEqual({ userId: '123' });
      expect(cannotPermission.scope).toBeUndefined();
    });

    it('should handle complex conditions object', () => {
      const complexConditions = {
        $and: [
          { userId: '123' },
          { appId: '456' },
          { $or: [{ role: 'admin' }, { role: 'manager' }] },
        ],
      };

      const canResult = can.read('user', complexConditions, 'app:123');
      const cannotResult = cannot.read('user', complexConditions, 'app:123');

      expect(canResult.conditions).toStrictEqual(complexConditions);
      expect(cannotResult.conditions).toStrictEqual(complexConditions);
    });

    it('should handle different scope formats', () => {
      const scopes: (ScopeString | undefined)[] = [
        undefined,
        '',
        'system',
        'org',
        'org:123',
        'app:456',
        'org:123:app:456',
      ];

      scopes.forEach((scope) => {
        const canResult = can.read('user', { userId: '123' }, scope);
        const cannotResult = cannot.read('user', { userId: '123' }, scope);

        expect(canResult.scope).toBe(scope);
        expect(cannotResult.scope).toBe(scope);
      });
    });
  });

  describe('performance and memory', () => {
    it('should create new objects for repeated access', () => {
      const firstAccess = can.read.user;
      const secondAccess = can.read.user;
      const thirdAccess = can.read.user;

      // The proxy should return a new object reference for each access
      expect(firstAccess).not.toBe(secondAccess);
      expect(secondAccess).not.toBe(thirdAccess);
      expect(firstAccess).not.toBe(thirdAccess);
    });

    it('should handle multiple subject-action combinations efficiently', () => {
      const subjects: Subject[] = ['user', 'org', 'app', 'role', 'all'];
      const actions: Action<'user'>[] = ['read', 'create', 'update', 'delete', 'manage'];

      // This should not throw or cause memory issues
      subjects.forEach((subject) => {
        if (subject === 'user') {
          actions.forEach((action) => {
            const canPermission = can[action][subject];
            const cannotPermission = cannot[action][subject];
            expect(canPermission).toBeDefined();
            expect(cannotPermission).toBeDefined();
          });
        }
      });
    });
  });
});
