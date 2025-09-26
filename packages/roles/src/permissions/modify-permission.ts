import { merge, cloneDeep } from 'lodash-es';

import { isScope, mergeScopes, Scope, stringifyScope } from '../scope';

import {
  Action,
  ConditionsQuery,
  ExtractContext,
  Permission,
  PermissionGroup,
  Subject,
  Context,
} from './types';

export interface ModifyPermissionOptions<C extends Context = Context> {
  scopePrefix?: Scope;
  additionalConditions?: ConditionsQuery<C>;
}

export const modifyPermission = <
  T extends Permission<Subject, Action> | PermissionGroup<Subject, Action>,
>(
  permission: T,
  options: ModifyPermissionOptions<ExtractContext<T>>,
): T => {
  const result: T = cloneDeep(permission);
  if (isScope(options.scopePrefix)) {
    result.scope = stringifyScope(mergeScopes(options.scopePrefix, permission.scope));
  }
  if (options.additionalConditions) {
    result.conditions = merge({}, result.conditions, options.additionalConditions);
  }
  return result;
};
