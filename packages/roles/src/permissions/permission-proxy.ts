import { isScope, stringifyScope } from '../scope';
import { Scope } from '../scope/types';

import { ActionType, ConditionsQuery, Permission, Subject, Context, Action } from './types';

export type PermissionProxy = {
  [S in Subject]: {
    [A in Action<S>]: Permission<S, A, 'can'>;
  } & PartialCreatePermissionMethod<S>;
} & typeof createPermission;

export type PartialCreatePermissionMethod<S extends Subject> = <
  A extends Action<S>,
  T extends ActionType = 'can',
  C extends Context = Context,
>(
  action: A | A[],
  type?: T,
  conditions?: ConditionsQuery<C>,
  scope?: Scope,
) => Permission<S, A, T, C>;

export const permission = new Proxy(createPermission as PermissionProxy, {
  get(_target, subject: Subject) {
    return new Proxy(createPermission, {
      apply(_target, _thisArg, argArray) {
        const [action, type, conditions, scope] = argArray as [
          Action,
          ActionType,
          ConditionsQuery,
          Scope,
        ];
        return createPermission(subject, action, type, conditions, scope);
      },
      get(_innerTarget, action: Action) {
        return createPermission(subject, action);
      },
    });
  },
});

export function createPermission<
  S extends Subject,
  A extends Action<S>,
  T extends ActionType,
  C extends Context = Context,
>(permission: Permission<S, A, T, C>): Permission<S, A, T, C>;
export function createPermission<
  S extends Subject,
  A extends Action<S>,
  T extends ActionType,
  C extends Context = Context,
>(
  subject: S | S[],
  action: A | A[],
  type?: T,
  conditions?: ConditionsQuery<C>,
  scope?: Scope,
): Permission<S, A, T, C>;
export function createPermission<
  S extends Subject,
  A extends Action<S>,
  T extends ActionType = 'can',
  C extends Context = Context,
>(
  permissionObjectOrSubject: Permission<S, A, T, C> | S | S[],
  action?: A | A[],
  type: T = 'can' as T,
  conditions?: ConditionsQuery<C>,
  scope?: Scope,
): Permission<S, A, T, C> {
  if (
    permissionObjectOrSubject && // eslint-disable-line @typescript-eslint/no-unnecessary-condition
    typeof permissionObjectOrSubject === 'object' &&
    !Array.isArray(permissionObjectOrSubject)
  ) {
    return permissionObjectOrSubject;
  }
  if (typeof permissionObjectOrSubject === 'undefined') {
    throw new Error('Subject is required');
  }
  if (typeof action === 'undefined') {
    throw new Error('Action is required');
  }
  const permission: Permission<S, A, T, C> = {
    subject: permissionObjectOrSubject,
    action,
    type,
  };

  if (conditions) {
    permission.conditions = conditions;
  }
  if (isScope(scope)) {
    permission.scope = stringifyScope(scope);
  }

  return permission;
}
