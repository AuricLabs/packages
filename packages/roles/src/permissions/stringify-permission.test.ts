import { describe, it, expect } from 'vitest';

import { ScopeString } from '../scope';

import { stringifyPermission } from './stringify-permission';
import { Permission, Subject, Action, PermissionString } from './types';

describe('stringifyPermission', () => {
  describe('basic permission stringification', () => {
    it('should stringify simple permission without conditions or scope', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
      };

      const result = stringifyPermission(permission);
      expect(result).toBe('user:read');
    });

    it('should stringify permission with type "cannot"', () => {
      const permission: Permission<'user', 'delete', 'cannot'> = {
        subject: 'user',
        action: 'delete',
        type: 'cannot',
      };

      const result = stringifyPermission(permission);
      expect(result).toBe('!user:delete');
    });

    it('should stringify permission with scope', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        scope: 'tenant:123' as ScopeString,
      };

      const result = stringifyPermission(permission);
      expect(result).toBe('tenant:123:user:read');
    });

    it('should stringify permission with conditions', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: { userId: '123' },
      };

      const result = stringifyPermission(permission);
      expect(result).toBe("user:read{userId:'123'}");
    });

    it('should stringify permission with scope and conditions', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        scope: 'tenant:123' as ScopeString,
        conditions: { userId: '123' },
      };

      const result = stringifyPermission(permission);
      expect(result).toBe("tenant:123:user:read{userId:'123'}");
    });

    it('should stringify permission with type "cannot", scope, and conditions', () => {
      const permission: Permission<'user', 'delete', 'cannot'> = {
        subject: 'user',
        action: 'delete',
        type: 'cannot',
        scope: 'tenant:123' as ScopeString,
        conditions: { userId: '123' },
      };

      const result = stringifyPermission(permission);
      expect(result).toBe("!tenant:123:user:delete{userId:'123'}");
    });
  });

  describe('array subjects and actions', () => {
    it('should stringify permission with array subject', () => {
      const permission: Permission<'user' | 'org', 'read', 'can'> = {
        subject: ['user', 'org'],
        action: 'read',
        type: 'can',
      };

      const result = stringifyPermission(permission);
      expect(result).toBe('user,org:read');
    });

    it('should stringify permission with array action', () => {
      const permission: Permission<'user', 'read' | 'create', 'can'> = {
        subject: 'user',
        action: ['read', 'create'],
        type: 'can',
      };

      const result = stringifyPermission(permission);
      expect(result).toBe('user:read,create');
    });

    it('should stringify permission with both array subject and action', () => {
      const permission: Permission<'user' | 'org', 'read' | 'create', 'can'> = {
        subject: ['user', 'org'],
        action: ['read', 'create'],
        type: 'can',
      };

      const result = stringifyPermission(permission);
      expect(result).toBe('user,org:read,create');
    });

    it('should stringify permission with array subject, action, scope, and conditions', () => {
      const permission: Permission<'user' | 'org', 'read' | 'create', 'can'> = {
        subject: ['user', 'org'],
        action: ['read', 'create'],
        type: 'can',
        scope: 'tenant:123' as ScopeString,
        conditions: { userId: '123' },
      };

      const result = stringifyPermission(permission);
      expect(result).toBe("tenant:123:user,org:read,create{userId:'123'}");
    });
  });

  describe('complex conditions', () => {
    it('should stringify permission with nested conditions', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: {
          $and: [
            { userId: '123' },
            { tenantId: '456' },
            { $or: [{ role: 'admin' }, { role: 'manager' }] },
          ],
        },
      };

      const result = stringifyPermission(permission);
      expect(result).toBe(
        "user:read{$and:[{userId:'123'},{tenantId:'456'},{$or:[{role:'admin'},{role:'manager'}]}]}",
      );
    });

    it('should stringify permission with array conditions', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: {
          roles: ['admin', 'manager', 'user'],
          permissions: ['read', 'write'],
        },
      };

      const result = stringifyPermission(permission);
      expect(result).toBe(
        "user:read{roles:['admin','manager','user'],permissions:['read','write']}",
      );
    });

    it('should stringify permission with numeric conditions', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: {
          age: { $gte: 18 },
          score: { $gt: 100 },
        },
      };

      const result = stringifyPermission(permission);
      expect(result).toBe('user:read{age:{$gte:18},score:{$gt:100}}');
    });
  });

  describe('edge cases', () => {
    it('should handle empty arrays for subject and action', () => {
      const permission: Permission<never, never, 'can'> = {
        subject: [],
        action: [],
        type: 'can',
      };

      const result = stringifyPermission(permission);
      expect(result).toBe(':');
    });

    it('should handle single element arrays', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: ['user'],
        action: ['read'],
        type: 'can',
      };

      const result = stringifyPermission(permission);
      expect(result).toBe('user:read');
    });

    it('should handle undefined type (defaults to "can")', () => {
      const permission: Permission<'user', 'read'> = {
        subject: 'user',
        action: 'read',
      };

      const result = stringifyPermission(permission);
      expect(result).toBe('user:read');
    });

    it('should handle empty string scope', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        scope: '',
      };

      const result = stringifyPermission(permission);
      expect(result).toBe(':user:read');
    });

    it('should handle null/undefined conditions', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        conditions: undefined,
      };

      const result = stringifyPermission(permission);
      expect(result).toBe('user:read');
    });

    it('should handle null/undefined scope', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
        scope: undefined,
      };

      const result = stringifyPermission(permission);
      expect(result).toBe('user:read');
    });
  });

  describe('all subject types', () => {
    it('should stringify permissions for all subjects', () => {
      const subjects: Subject[] = ['all', 'org', 'app', 'role', 'user'];
      const actions: Action[] = ['read', 'create', 'update', 'delete'];

      subjects.forEach((subject) => {
        actions.forEach((action) => {
          if (
            action in
            {
              manage: true,
              assign: true,
              unassign: true,
              invite: true,
              remove: true,
            }
          ) {
            return; // Skip actions that don't apply to all subjects
          }

          const permission: Permission<Subject, Action, 'can'> = {
            subject,
            action,
            type: 'can',
          };

          const result = stringifyPermission(permission);
          expect(result).toBe(`${subject}:${action}`);
        });
      });
    });

    it('should stringify permissions with subject-specific actions', () => {
      // Test app-specific actions
      const appAssignPermission: Permission<'app', 'assign', 'can'> = {
        subject: 'app',
        action: 'assign',
        type: 'can',
      };
      expect(stringifyPermission(appAssignPermission)).toBe('app:assign');

      // Test role-specific actions
      const roleUnassignPermission: Permission<'role', 'unassign', 'can'> = {
        subject: 'role',
        action: 'unassign',
        type: 'can',
      };
      expect(stringifyPermission(roleUnassignPermission)).toBe('role:unassign');

      // Test user-specific actions
      const userInvitePermission: Permission<'user', 'invite', 'can'> = {
        subject: 'user',
        action: 'invite',
        type: 'can',
      };
      expect(stringifyPermission(userInvitePermission)).toBe('user:invite');
    });
  });

  describe('type safety', () => {
    it('should maintain type safety for PermissionStringFromPermission', () => {
      const permission: Permission<'user', 'read', 'can'> = {
        subject: 'user',
        action: 'read',
        type: 'can',
      };

      const result = stringifyPermission(permission);

      // This should compile without type errors
      const permissionString: string = result;
      expect(typeof permissionString).toBe('string');
    });

    it('should work with generic permission types', () => {
      function createAndStringify<S extends Subject, A extends Action<S>>(
        subject: S,
        action: A,
      ): PermissionString<S, A, 'can'> {
        return stringifyPermission({
          subject,
          action,
          type: 'can',
        });
      }

      const result = createAndStringify('user', 'read');
      expect(result).toBe('user:read');
    });
  });
});
