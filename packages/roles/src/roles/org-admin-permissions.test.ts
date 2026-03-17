import { describe, it, expect } from 'vitest';

import {
  createAbility,
  flattenPermissions,
  permission,
  createOrgScope,
  createAppScope,
  createPermissionsFromRoles,
} from '../index';

describe('org admin permission check for app management', () => {
  const orgId = 'org-123';
  const appId = 'app-456';
  const orgScope = createOrgScope(orgId);

  const createOrgAdminAbility = (scope = orgScope) => {
    const userPermissions = createPermissionsFromRoles([
      {
        permissions: [permission.all.manage],
        scope,
      },
    ]);
    return createAbility(userPermissions);
  };

  it('should allow all.manage at org scope to match app.assignUser + role.read at org scope', () => {
    const ability = createOrgAdminAbility();

    // This is what AssignOrgAppUser component checks with scope={orgScope}
    const requiredPermissions = [permission.app.assignUser, permission.role.read];
    const flattenedRequired = flattenPermissions(requiredPermissions, { scopePrefix: orgScope });

    expect(ability.hasAll(flattenedRequired)).toBe(true);
  });

  it('should allow all.manage at org scope to match app.unassignUser at org scope', () => {
    const ability = createOrgAdminAbility();

    const requiredPermissions = [permission.app.unassignUser];
    const flattenedRequired = flattenPermissions(requiredPermissions, { scopePrefix: orgScope });

    expect(ability.hasAll(flattenedRequired)).toBe(true);
  });

  it('should allow all.manage at org scope to match user.read at org scope', () => {
    const ability = createOrgAdminAbility();

    const requiredPermissions = [permission.user.read];
    const flattenedRequired = flattenPermissions(requiredPermissions, { scopePrefix: orgScope });

    expect(ability.hasAll(flattenedRequired)).toBe(true);
  });

  it('should NOT match when org scope does not match', () => {
    const ability = createOrgAdminAbility(createOrgScope('org-other'));

    const requiredPermissions = [permission.app.assignUser];
    const flattenedRequired = flattenPermissions(requiredPermissions, { scopePrefix: orgScope });

    expect(ability.hasAll(flattenedRequired)).toBe(false);
  });

  it('should NOT match when required permissions are checked at app scope (child of org)', () => {
    const ability = createOrgAdminAbility();

    // When OidcProtectedComponent defaults to app-level scope from context,
    // the scope becomes org:org-123:app:app-456 which does NOT match org:org-123
    const appScope = createAppScope(appId, orgId);
    const requiredPermissions = [permission.app.assignUser, permission.role.read];
    const flattenedRequired = flattenPermissions(requiredPermissions, { scopePrefix: appScope });

    // This should be FALSE because the org admin's all.manage is at org:org-123
    // but the check is at org:org-123:app:app-456 - scopes use exact matching
    expect(ability.hasAll(flattenedRequired)).toBe(false);
  });
});
