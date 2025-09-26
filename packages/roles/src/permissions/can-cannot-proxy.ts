import { ScopeString } from '../scope';

import { createPermission, permission } from './permission-proxy';
import {
  Action,
  ActionsForSubject,
  ActionType,
  ConditionsQuery,
  Permission,
  Subject,
  Context,
  SubjectsWithActions,
} from './types';

export type CreatePermissionMethod<T extends ActionType, A extends Action> = <
  S extends SubjectsWithActions<A>,
  C extends Context,
>(
  subject: S | S[],
  conditions?: ConditionsQuery<C>,
  scope?: ScopeString,
) => Permission<S, ActionsForSubject<S, A>, T, C>;

export type CanCannotProxy<T extends ActionType> = {
  [A in Action]: {
    [S in SubjectsWithActions<A>]: Permission<S, ActionsForSubject<S, A>, T>;
  } & CreatePermissionMethod<T, A>;
} & CanCannotMethod<T>;

export type CanCannotMethod<T extends ActionType> = <
  A extends Action,
  S extends SubjectsWithActions<A>,
  C extends Context,
>(
  action: A | A[],
  subject: S | S[],
  conditions?: ConditionsQuery<C>,
  scope?: ScopeString,
) => Permission<S, ActionsForSubject<S, A>, T, C>;

export const can = createCanCannotProxy('can');
export const cannot = createCanCannotProxy('cannot');

function createCanCannotProxy<T extends ActionType>(type: T) {
  return new Proxy(createPermission as unknown as CanCannotProxy<T>, {
    apply(_target, _thisArg, argArray) {
      const [action, subject, conditions, scope] = argArray as [
        Action,
        Subject,
        ConditionsQuery,
        ScopeString,
      ];
      return permission(subject, action, type, conditions, scope);
    },
    get(_: unknown, action: Action) {
      return new Proxy(createPermission, {
        apply(
          _target,
          _thisArg,
          argArray: [SubjectsWithActions<Action>, ConditionsQuery, ScopeString],
        ) {
          const [subject, conditions, scope] = argArray;
          // @ts-expect-error action fails type assertions
          return permission(subject, action, type, conditions, scope);
        },
        get(_innerTarget, subject: SubjectsWithActions<Action>) {
          return permission({
            subject,
            // @ts-expect-error action fails type assertions
            action,
            type,
          });
        },
      });
    },
  });
}
