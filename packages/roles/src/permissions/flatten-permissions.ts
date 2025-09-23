import { merge } from 'lodash';

import { isScope, mergeScopes, stringifyScope } from '../scope';

import { isPermissionGroup } from './is-permission-group';
import { modifyPermission, ModifyPermissionOptions } from './modify-permission';
import { parsePermission } from './parse-permission';
import { parsePermissionString } from './parse-permission-string';
import {
  Action,
  ActionType,
  ExtractContext,
  Permission,
  PermissionOrGroupOrString,
  Subject,
  Context,
} from './types';

const isFlattenedMap = new WeakMap<readonly PermissionOrGroupOrString[], boolean>();

/**
 * Pure flattening function that returns raw Permission entries without modification
 */
const flattenPermissionsPure = <
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
  C extends Context = Context,
>(
  permissions: readonly PermissionOrGroupOrString<S, A, T, C>[],
): Permission<S, A, T, C>[] => {
  return permissions.flatMap((groupOrPermission) => {
    if (typeof groupOrPermission === 'string') {
      return [parsePermissionString(groupOrPermission)];
    } else if (isPermissionGroup(groupOrPermission)) {
      // then p is a group
      return groupOrPermission.permissions
        .flatMap((p) => {
          if (isPermissionGroup(p)) {
            return flattenPermissionsPure<S, A, T, C>(p.permissions);
          }
          return [parsePermission(p)];
        })
        .map(({ ...result }) => {
          if (groupOrPermission.conditions) {
            result.conditions = merge({}, groupOrPermission.conditions, result.conditions);
          }
          if (isScope(groupOrPermission.scope)) {
            result.scope = stringifyScope(mergeScopes(groupOrPermission.scope, result.scope));
          }
          return result;
        });
    }
    return [groupOrPermission];
  });
};

/**
 * Flattens a set of permissions into a set of raw Permission entries.
 * @param permissions - The permissions to flatten.
 * @param options - The options to apply to the permissions.
 * @returns The flattened permissions.
 */
export const flattenPermissions = <
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
  C extends Context = Context,
>(
  permissions: readonly PermissionOrGroupOrString<S, A, T, C>[],
  options?: ModifyPermissionOptions<C>,
): readonly Permission<S, A, T, C>[] => {
  const isFlattened = isFlattenedMap.get(permissions);

  // First, flatten all permissions to raw Permission entries
  let flattenedPermissions: Permission<S, A, T, C>[] = isFlattened
    ? (permissions as Permission<S, A, T, C>[])
    : flattenPermissionsPure<S, A, T, C>(permissions);

  if (options) {
    // Then apply modifyPermission exactly once to each permission using the provided options
    flattenedPermissions = flattenedPermissions.map((p) =>
      modifyPermission(
        p,
        options as ModifyPermissionOptions<ExtractContext<Permission<S, A, T, C>>>,
      ),
    );
  }

  return Object.freeze(flattenedPermissions);
};
