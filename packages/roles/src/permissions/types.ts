import { ShapeQuery } from 'sift';

import { Scope, ScopeString } from '../scope';

export type ActionType = 'can' | 'cannot';
export type CRUDAction = 'manage' | 'read' | 'create' | 'update' | 'delete';

export interface PermissionDefinitions {
  all: CRUDAction;
  org: CRUDAction;
  app: CRUDAction | 'assign' | 'unassign';
  role: CRUDAction | 'assign' | 'unassign';
  user: CRUDAction | 'invite' | 'remove';
  webhook: CRUDAction;
  webhookSecret: CRUDAction | 'refresh';
  webhookSubscription: CRUDAction;
}

export interface BasePermission<C extends Context = Context> {
  conditions?: ConditionsQuery<C> | C;
  scope?: Scope;
}

export type Subject = Extract<keyof PermissionDefinitions, string>;

export type Action<S extends Subject = Subject> = PermissionDefinitions[S];

// Generic type to extract permission string format for any subject and action
// TODO it seems comma separated actions are hard to type and require a lot of resources, so i have left them out.
export type PermissionString<
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
> =
  | (T extends 'can' ? PrefixWithScope<`${S}:${A}` | `${S}:${A}{${string}}`> : never)
  | (T extends 'cannot' ? `!${PrefixWithScope<`${S}:${A}` | `${S}:${A}{${string}}`>}` : never)
  | string;

export type PrefixWithScope<S extends string> = `${Exclude<ScopeString, ''>}:${S}` | S;

export type PermissionStringFromPermission<P extends PermissionOrString> =
  P extends PermissionOrString<infer S, infer A, infer T> ? PermissionString<S, A, T> : never;

export type PermissionFromPermissionString<P extends PermissionString> =
  P extends PermissionString<infer S, infer A, infer T> ? Permission<S, A, T> : never;

export type ExtractSubject<S extends Subject | Subject[]> = S extends Subject
  ? S
  : S extends Subject[]
    ? S[number]
    : never;

export type ExtractAction<A extends Action | Action[]> = A extends Action
  ? A
  : A extends Action[]
    ? A[number]
    : never;

export type Context = Record<string, unknown>;
export type ConditionsQuery<T extends Context = Context> = ShapeQuery<T>;
export interface Permission<
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
  C extends Context = Context,
> extends BasePermission<C> {
  type?: T;
  action: A | A[];
  subject: S | S[];
}

export type ActionsForSubject<S extends Subject, A extends Action = Action> =
  A extends Action<S> ? A : never;

export interface PermissionGroup<
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
  C extends Context = Context,
> extends BasePermission<C> {
  permissions: PermissionOrGroup<S, A, T, C>[];
}

export type PermissionOrGroup<
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
  C extends Context = Context,
> = Permission<S, A, T, C> | PermissionGroup<S, A, T, C>;

export type PermissionOrGroupOrString<
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
  C extends Context = Context,
> = PermissionOrGroup<S, A, T, C> | PermissionString<S, A, T>;

export type PermissionOrString<
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
  C extends Context = Context,
> = Permission<S, A, T, C> | PermissionString<S, A, T>;

export type SubjectsWithActions<A extends Action> = {
  [S in Subject]: [A] extends [Action<S>] ? S : never;
}[Subject];

export type ExtractContext<T> =
  T extends Permission<Subject, Action, ActionType, infer C>
    ? C
    : T extends PermissionGroup<Subject, Action, ActionType, infer C>
      ? C
      : never;
