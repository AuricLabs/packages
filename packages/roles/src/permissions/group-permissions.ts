import { cloneDeep, isEqual } from 'lodash';

import { isGlobalScope, stringifyScope } from '../scope';

import { isPermissionGroup } from './is-permission-group';
import { parsePermission } from './parse-permission';
import {
  Action,
  ActionType,
  PermissionOrGroup,
  PermissionGroup,
  Subject,
  Context,
  PermissionOrGroupOrString,
} from './types';

export interface GroupPermissionsOptions {
  ignoreScope?: boolean;
  ignoreConditions?: boolean;
}

/**
 * Groups permissions by conditions and scope.
 * @param permissions - The permissions to group.
 * @returns The grouped permissions.
 */
export const groupPermissions = <
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
  C extends Context = Context,
>(
  permissions: PermissionOrGroupOrString<S, A, T, C>[],
  { ignoreScope, ignoreConditions }: GroupPermissionsOptions = {},
): PermissionGroup<S, A, T, C>[] => {
  const permissionGroups: PermissionGroup<S, A, T, C>[] = [];
  permissions
    .map((p) => parsePermission(p) as PermissionOrGroup<S, A, T, C>)
    .forEach((permissionOrGroup) => {
      const scope = permissionOrGroup.scope;
      const conditions = permissionOrGroup.conditions;
      const groupMatch = permissionGroups.find(
        (group) =>
          (ignoreConditions ?? isEqual(group.conditions, conditions)) &&
          (ignoreScope ?? stringifyScope(group.scope) === stringifyScope(scope)),
      );

      if (isPermissionGroup(permissionOrGroup)) {
        const normalizedPermissionGroup = normalizePermissionOrGroup(permissionOrGroup, {
          ignoreScope,
          ignoreConditions,
        });
        if (groupMatch) {
          // Confirm it is 100% the same, not including the ignore options
          if (normalizedPermissionGroup.scope || normalizedPermissionGroup.conditions) {
            // the groups only partially match so lets clean this group and add it as a child
            groupMatch.permissions.push(normalizedPermissionGroup);
          } else {
            // the groups match 100% so lets combine them
            groupMatch.permissions.push(...normalizedPermissionGroup.permissions);
          }
        } else {
          // we are safe to just push this one to the array of groups
          permissionGroups.push(cloneDeep(permissionOrGroup));
        }
      } else {
        const normalizedPermission = normalizePermissionOrGroup(permissionOrGroup, {
          ignoreScope,
          ignoreConditions,
        });
        if (groupMatch) {
          if (groupMatch.permissions.find((p) => isEqual(p, normalizedPermission))) {
            // there is no need to add this one again
            return;
          }
          groupMatch.permissions.push(normalizedPermission);
        } else {
          // create a new permission group with the normalized permission
          permissionGroups.push({
            permissions: [normalizedPermission],
            ...(!ignoreConditions && conditions && { conditions }),
            ...(!ignoreScope && !isGlobalScope(scope) && { scope: stringifyScope(scope) }),
          });
        }
      }
    });
  return permissionGroups;
};

/**
 * Normalizes a permission or group by removing the scope and conditions if the options are set.
 * @param permissionOrGroup - The permission or group to normalize.
 * @param options - The options to normalize the permission or group.
 * @returns The normalized permission or group.
 */
const normalizePermissionOrGroup = <T extends PermissionOrGroup>(
  { ...permissionOrGroup }: T,
  options: GroupPermissionsOptions,
): T => {
  if (!options.ignoreScope) {
    delete permissionOrGroup.scope;
  }
  if (!options.ignoreConditions) {
    delete permissionOrGroup.conditions;
  }
  return cloneDeep(permissionOrGroup);
};
