import JSON5 from 'json5';

import { isScope, ScopeString } from '../scope';

import {
  Action,
  ActionType,
  ConditionsQuery,
  Permission,
  PermissionString,
  Subject,
  Context,
} from './types';

/**
 * Example permission strings:
 * - "user:read"
 * - "user:read{active:true}"
 * - "user:read{active:true,orgId:123}"
 * - "user:read{active:true,orgId:123,limit:10,offset:0,sort:name}"
 * - "!org:123:user,role:read,write{active:true,orgId:123,limit:10}"
 * - "!org:123:user,role:read,write{active:true,orgId:123,limit:10,offset:0,sort:name}"
 */

/**
 * Parses a permission string and returns the subject, action, and conditions.
 * @param permissionString - The permission string to parse.
 * @returns The parsed permission string.
 */
export function parsePermissionString<
  S extends Subject,
  A extends Action<S>,
  T extends ActionType,
  C extends Context = Context,
>(permissionString: PermissionString<S, A, T>): Permission<S, A, T, C> {
  // example format: "user:read"
  let type: ActionType = 'can';
  const curlyIndex = permissionString.search(/[{}]/i);
  const scopeSubjectAndActions =
    curlyIndex !== -1 ? permissionString.substring(0, curlyIndex) : permissionString;
  const conditionsString = curlyIndex !== -1 ? permissionString.substring(curlyIndex) : undefined;
  let splitPermissionString: string[] = [];
  if (permissionString.startsWith('!')) {
    type = 'cannot';
    splitPermissionString = scopeSubjectAndActions.substring(1).split(':');
  } else {
    splitPermissionString = scopeSubjectAndActions.split(':');
  }

  const actionOrActions = splitPermissionString.pop() ?? '';
  const subjectOrSubjects = splitPermissionString.pop() ?? '';
  const scope =
    splitPermissionString.length > 0 ? (splitPermissionString.join(':') as ScopeString) : undefined;

  let subject: string | string[] = subjectOrSubjects;
  let action: string | string[] = actionOrActions
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  subject = subject
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (Array.isArray(action) && action.length <= 1) {
    action = action[0];
  }

  if (Array.isArray(subject) && subject.length <= 1) {
    subject = subject[0];
  }

  let conditions: ConditionsQuery<C> | undefined;
  if (conditionsString) {
    try {
      conditions = conditionsString ? JSON5.parse(conditionsString) : undefined;
    } catch {
      throw new Error(
        `Invalid conditions string: '${conditionsString}' for permission string: '${permissionString}'`,
      );
    }
  }

  if (!subject || !action) {
    throw new Error(`Invalid permission string format: '${permissionString}'`);
  }

  const permission: Permission<S, A, T, C> = {
    action: action as A | A[],
    subject: subject as S | S[],
    type: type as T,
  };

  if (isScope(scope)) {
    permission.scope = scope;
  }

  if (conditions) {
    permission.conditions = conditions;
  }

  return permission;
}
