import {
  flattenPermissions,
  groupPermissions,
  GroupPermissionsOptions,
  PermissionOrGroup,
  modifyPermission,
  ModifyPermissionOptions,
} from '../permissions';

import { extractScopePermissions } from './extract-scope-permissions';
import { Role } from './types';

export type CreatePermissionsFromRolesOptions = ModifyPermissionOptions & GroupPermissionsOptions;

/**
 * This method is used as a user signs in and grants a user permissions based on their roles.
 * It is used to determine which permissions the user has based on their roles and the conditions
 * that are passed in.
 *
 * @note Not to be mistaken for parseRequiredPermissions which creates a testable set of permissions for an ability.
 *
 * @param roles
 * @param conditions
 * @returns
 */
export function createPermissionsFromRoles(
  roles: Omit<Role, 'name'>[],
  {
    ignoreScope,
    ignoreConditions = true,
    ...modifyPermissionOptions
  }: CreatePermissionsFromRolesOptions = {},
): PermissionOrGroup[] {
  const flatPermissions = roles.flatMap((role) => {
    return [
      ...extractScopePermissions(role.userScope ?? role.scope),
      ...flattenPermissions(role.permissions, {
        scopePrefix: role.userScope ?? role.scope,
        additionalConditions: role.conditions,
      }),
    ];
  });

  const allPermissions = flatPermissions
    .flatMap((permission) => {
      return [...extractScopePermissions(permission.scope), permission];
    })
    .map((p) => modifyPermission(p, modifyPermissionOptions));

  const groupedPermissions = groupPermissions(allPermissions, {
    ignoreConditions,
    ignoreScope,
  });

  const emptyIndex = groupedPermissions.findIndex((p) => !p.scope && !p.conditions);

  if (emptyIndex !== -1) {
    const emptyPermissions = groupedPermissions.splice(emptyIndex, 1)[0];
    return [...emptyPermissions.permissions, ...groupedPermissions];
  }

  return groupedPermissions;
}
