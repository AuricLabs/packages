import { Action, ActionType, PermissionGroup, Subject, Context } from '../permissions';
import { ScopeString } from '../scope';

export interface Role<
  S extends Subject = Subject,
  A extends Action<S> = Action<S>,
  T extends ActionType = ActionType,
  C extends Context = Context,
> extends PermissionGroup<S, A, T, C> {
  name: string;
  userScope?: ScopeString;
  isGlobal?: boolean;
}
