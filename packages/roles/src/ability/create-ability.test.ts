import {
  Permission,
  PermissionGroup,
  Action,
  permission,
  cannot,
  can,
  PermissionString,
  parsePermission,
  flattenPermissions,
} from '../permissions';
import { permissionGroup } from '../permissions/permission-group';

import { Ability, createAbility } from './create-ability';

describe('createAbility', () => {
  let ability: Ability;
  const roleUnassignPermission = permission({
    subject: 'role',
    action: 'unassign',
    type: 'can',
    scope: 'app:456',
  });

  beforeEach(() => {
    ability = createAbility([
      permission.user.read,
      permission.user.create,
      permission.org.manage,
      permission.app.read,
      permission.role.assign,
      cannot.delete.user,
      cannot.manage.app,
      roleUnassignPermission,
    ]);
  });

  describe('basic permission checking', () => {
    it('should return true when ability has all required permissions', () => {
      const permissions = [permission.user.read, permission.user.create, permission.org.manage];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });

    it('should return false when ability lacks any required permission', () => {
      const permissions: Permission[] = [
        { action: 'read', subject: 'user' },
        { action: 'delete', subject: 'user' }, // This permission is not allowed
      ];

      const result = ability.has(permissions);
      expect(result).toBe(false);
    });

    it('should handle explicit "can" type permissions', () => {
      const permissions: Permission[] = [
        { action: 'read', subject: 'user', type: 'can' },
        { action: 'create', subject: 'user', type: 'can' },
      ];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });

    it('should handle "cannot" type permissions', () => {
      const permissions = [cannot.delete.user, cannot.manage.app];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });
  });

  describe('scope handling', () => {
    it('should add scope to subject properties when scope is provided', () => {
      const permissions: Permission[] = [{ action: 'read', subject: 'user', scope: 'org:123' }];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });

    it('should merge scope with existing subject properties', () => {
      const permissions: Permission[] = [{ action: 'read', subject: 'user', scope: 'org:123' }];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });

    it('should handle multiple permissions with different scopes', () => {
      const permissions: Permission[] = [
        { action: 'read', subject: 'user', scope: 'org:123' },
        { action: 'unassign', subject: 'role', scope: 'app:456' },
      ];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });
  });

  describe('subject properties handling', () => {
    it('should pass subject properties to CASL subject creation', () => {
      const context = { userId: '123', orgId: '456' };
      const permissions: Permission[] = [{ action: 'read', subject: 'user' }];

      const result = ability.has(
        flattenPermissions(permissions, {
          additionalConditions: context,
        }),
      );
      expect(result).toBe(true);
    });

    it('should work without subject properties', () => {
      const permissions: Permission[] = [{ action: 'read', subject: 'user' }];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });

    it('should merge scope with subject properties when both are present', () => {
      const context = { userId: '123' };
      const permissions: Permission[] = [{ action: 'read', subject: 'user', scope: 'org:456' }];

      const result = ability.has(
        flattenPermissions(permissions, {
          additionalConditions: context,
        }),
      );
      expect(result).toBe(true);
    });
  });

  describe('global scope', () => {
    it('should handle global scope', () => {
      // this is a global scope permission
      expect(ability.has([':role:unassign'])).toBe(false);
      // this is a role permission in itself (ignores scope)
      expect(ability.has(['role:unassign'])).toBe(true);
    });
  });

  describe('array subjects and actions', () => {
    it('should handle array of subjects', () => {
      const permissions: Permission[] = [{ action: 'read', subject: ['user', 'org'] }];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });

    it('should handle array of actions', () => {
      const permissions: Permission[] = [{ action: ['read', 'create'], subject: 'user' }];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });

    it('should handle arrays of both subjects and actions', () => {
      const permissions: Permission[] = [{ action: ['read', 'create'], subject: ['user', 'org'] }];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });

    it('should return false if any subject-action combination is not allowed', () => {
      const permissions: Permission[] = [
        { action: ['read', 'delete'], subject: 'user' }, // delete is not allowed
      ];

      const result = ability.has(permissions);
      expect(result).toBe(false);
    });
  });

  describe('scope permissions', () => {
    it('should handle scope permissions', () => {
      const userPermissions: PermissionString[] = ['app:123:all:manage'];
      const requiredPermissions: PermissionString[] = ['org:123:user:read'];
      ability = createAbility(userPermissions.map(parsePermission));
      const result = ability.has(requiredPermissions);
      expect(result).toBe(false);
    });

    it('should handle scope permissions with conditions', () => {
      const userPermissions: PermissionString[] = [
        'org:*:app:d84db635-5df0-4932-865b-02a510a57c8a:all:manage',
        "role:read{appId:'d84db635-5df0-4932-865b-02a510a57c8a'}",
      ];
      ability = createAbility(userPermissions.map(parsePermission));
      expect(ability.has(['app:adasdsa:user:read'])).toBe(false);
      expect(ability.has(['org:124:app:d84db635-5df0-4932-865b-02a510a57c8a:user:read'])).toBe(
        true,
      );
      expect(ability.has(['role:read'])).toBe(true);
      expect(ability.has([':role:read{}'], {})).toBe(false);
      expect(ability.has(['role:read{appId:"d84db635-5df0-4932-865b-02a510a57c8a"}'])).toBe(true);
    });
  });

  describe('permission groups', () => {
    it('should handle permission groups', () => {
      const permissionGroup: PermissionGroup = {
        permissions: [
          { action: 'read', subject: 'user' },
          { action: 'manage', subject: 'org' },
        ],
      };

      const result = ability.has(permissionGroup);
      expect(result).toBe(true);
    });

    it('should handle nested permission groups', () => {
      const nestedGroup = permissionGroup({
        permissions: [
          permission.user.read,
          {
            permissions: [permission.org.manage, roleUnassignPermission],
          },
        ],
      });

      const result = ability.has(nestedGroup);
      expect(result).toBe(true);
    });

    it('should handle permission groups with scope', () => {
      const permissionGroup: PermissionGroup = {
        scope: 'org:123',
        permissions: [
          { action: 'read', subject: 'user' },
          { action: 'manage', subject: 'org' },
        ],
      };

      const result = ability.has(permissionGroup);
      expect(result).toBe(true);
    });
  });

  describe('permission strings', () => {
    it('should handle permission strings', () => {
      const permissions = ['user:read', 'org:manage'];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });

    it('should handle permission strings with scope', () => {
      const permissions = ['org:123:user:read', 'org:456:org:manage'];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });

    it('should fail when there is a cannot as well as a can permission', () => {
      const permissions = [can.read.app];
      const result = ability.has(permissions);
      expect(result).toBe(false);
    });

    it('should handle mixed permission types', () => {
      const permissions = [permission.user.read, permission.org.manage, roleUnassignPermission];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return true for empty permissions array', () => {
      const result = ability.has([]);
      expect(result).toBe(true);
    });

    it('should handle permissions with conditions (should be ignored by this function)', () => {
      const permissions: Permission[] = [
        { action: 'read', subject: 'user', conditions: { userId: '123' } },
      ];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });

    it('should handle complex nested structures', () => {
      const complexPermissions = [
        permission.user.read,
        permissionGroup({
          permissions: [
            permission.org.manage,
            permissionGroup({
              permissions: [permission.role.assign, roleUnassignPermission],
            }),
          ],
        }),
      ];

      const result = ability.has(complexPermissions);
      expect(result).toBe(true);
    });
  });

  describe('type safety', () => {
    it('should work with generic type parameters', () => {
      const permissions: Permission<'user', 'read' | 'create'>[] = [
        permission.user.read,
        permission.user.create,
      ];

      const result = ability.has(permissions);
      expect(result).toBe(true);
    });

    it('should work with different subject types', () => {
      const userPermissions: Permission<'user', Action<'user'>>[] = [
        { action: 'read', subject: 'user' },
      ];

      const orgPermissions: Permission<'org', Action<'org'>>[] = [
        { action: 'manage', subject: 'org' },
      ];

      const userResult = ability.has(userPermissions);
      const orgResult = ability.has(orgPermissions);

      expect(userResult).toBe(true);
      expect(orgResult).toBe(true);
    });
  });

  describe('complex permission scenario', () => {
    it('should handle complex permission with projectRoleTags condition', () => {
      const permissions = [
        "org:2e984629-8b26-4646-ba09-9467386b39b5:app:f8c67017-b165-4eda-a6a4-ce72acb9ea43:project:f0fc4827-497e-4e96-91da-42dbb5832970:org:create{projectRoleTags:'lead_architect_designer'}",
      ];
      const scope =
        'org:2e984629-8b26-4646-ba09-9467386b39b5:app:f8c67017-b165-4eda-a6a4-ce72acb9ea43:project:f0fc4827-497e-4e96-91da-42dbb5832970';

      const ability = createAbility(permissions);

      const result = ability.has([
        {
          action: 'create',
          subject: 'org',
          scope,
        },
      ]);

      expect(result).toBe(true);
    });
  });

  describe('cannot permissions for non-existent permissions', () => {
    it('should return true when testing a cannot permission that does not exist in granted permissions', () => {
      // Create ability with only specific permissions (no 'delete' permission for 'project' subject)
      const ability = createAbility([
        permission.user.read,
        permission.user.create,
        permission.org.manage,
        permission.app.read,
        permission.role.assign,
      ]);

      // Test a 'cannot' permission for a subject-action combination that doesn't exist in granted permissions
      // @ts-expect-error project is not a valid subject
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = ability.has(cannot.delete.project);

      // Should return true because the permission doesn't exist in granted permissions
      // and we're testing with 'cannot' type
      expect(result).toBe(true);
    });

    it('should return true when testing multiple cannot permissions that do not exist in granted permissions', () => {
      // Create ability with limited permissions
      const ability = createAbility([
        permission.user.read,
        permission.user.create,
        permission.org.manage,
      ]);

      // Test multiple 'cannot' permissions for subject-action combinations that don't exist
      const result = ability.has([
        // @ts-expect-error project is not a valid subject
        cannot.delete.project,
        // @ts-expect-error task is not a valid subject
        cannot.manage.task,
        // @ts-expect-error workflow is not a valid subject
        cannot.create.workflow,
      ]);

      // Should return true because none of these permissions exist in granted permissions
      expect(result).toBe(true);
    });

    it('should return false when testing a cannot permission that explicitly exists in granted permissions', () => {
      // Create ability that explicitly grants 'delete' permission for 'user' subject
      const ability = createAbility([
        permission.user.read,
        permission.user.create,
        permission.user.delete, // This explicitly grants delete permission
        permission.org.manage,
      ]);

      // Test a 'cannot' permission for a subject-action combination that DOES exist
      const result = ability.has(cannot.delete.user);

      // Should return false because the permission exists in granted permissions
      // and we're testing with 'cannot' type
      expect(result).toBe(false);
    });
  });
});
