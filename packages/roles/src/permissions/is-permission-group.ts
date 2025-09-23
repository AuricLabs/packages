import {
  Action,
  ActionType,
  PermissionGroup,
  PermissionOrGroupOrString,
  Subject,
  Context,
} from './types';

/**
 * Checks if a permission is a permission group.
 * @param permission - The permission to check.
 * @returns True if the permission is a permission group, false otherwise.
 */
export const isPermissionGroup = <
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
  C extends Context = Context,
>(
  permission: PermissionOrGroupOrString<S, A, T, C>,
): permission is PermissionGroup<S, A, T, C> => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return typeof permission === 'object' && permission !== null && 'permissions' in permission;
};
