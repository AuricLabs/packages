import { ScopeString } from '../scope';

import { parsePermission } from './parse-permission';
import {
  Action,
  ActionType,
  PermissionOrGroup,
  ConditionsQuery,
  PermissionGroup,
  Subject,
  Context,
  PermissionOrGroupOrString,
} from './types';

export function permissionGroup<
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
  C extends Context = Context,
>(permissions: PermissionGroup<S, A, T, C>): PermissionGroup<S, A, T, C>;
export function permissionGroup<
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
  C extends Context = Context,
>(
  permissions: PermissionOrGroup<S, A, T, C>[],
  conditions?: ConditionsQuery<C>,
  scope?: ScopeString,
): PermissionGroup<S, A, T, C>;
export function permissionGroup<
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
  C extends Context = Context,
>(
  permissions: PermissionOrGroupOrString<S, A, T, C>[] | PermissionGroup<S, A, T, C>,
  conditions?: ConditionsQuery<C>,
  scope?: ScopeString,
): PermissionGroup<S, A, T, C> {
  if (Array.isArray(permissions)) {
    return {
      permissions: permissions.map((p) => parsePermission(p) as PermissionOrGroup<S, A, T, C>),
      conditions,
      scope,
    };
  }
  return permissions;
}
