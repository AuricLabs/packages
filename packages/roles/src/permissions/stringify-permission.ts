import JSON5 from 'json5';

import { isScope, stringifyScope } from '../scope';

import { PermissionOrString, PermissionStringFromPermission } from './types';

/**
 * Parses a permission string and returns the subject, action, and conditions.
 * @param permission - The permission to parse.
 * @returns The parsed permission string.
 */
export function stringifyPermission<P extends PermissionOrString>(
  permission: P,
): PermissionStringFromPermission<P> {
  if (typeof permission === 'string') {
    return permission as unknown as PermissionStringFromPermission<P>;
  }

  let conditions = '';
  if (permission.conditions) {
    conditions = JSON5.stringify(permission.conditions);
  }

  const subject = Array.isArray(permission.subject)
    ? permission.subject.join(',')
    : permission.subject;

  const action = Array.isArray(permission.action) ? permission.action.join(',') : permission.action;

  const scope = isScope(permission.scope) ? `${stringifyScope(permission.scope)}:` : '';
  const type = permission.type === 'cannot' ? '!' : '';

  return `${type}${scope}${subject}:${action}${conditions}` as unknown as PermissionStringFromPermission<P>;
}
