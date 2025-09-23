import { isPermissionGroup } from './is-permission-group';
import {
  Action,
  ActionType,
  Permission,
  PermissionOrGroupOrString,
  Subject,
  Context,
} from './types';

/**
 * Checks if a permi tession is a permission.
 * @param permission - The permission to check.
 * @returns True if the permission is a permission, false otherwise.
 */
export const isPermission = <
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
  C extends Context = Context,
>(
  permission: PermissionOrGroupOrString<S, A, T, C>,
): permission is Permission<S, A, T, C> => {
  return (
    typeof permission === 'string' ||
    (typeof permission === 'object' &&
      permission !== null && // eslint-disable-line @typescript-eslint/no-unnecessary-condition
      !isPermissionGroup(permission) &&
      'action' in permission &&
      'subject' in permission)
  );
};
