import { parseScope } from './parse-scope';
import { Scope, ScopeSubjectArray } from './types';

export const mergeScopes = (...scopes: (Scope | undefined)[]): ScopeSubjectArray => {
  return scopes.flatMap((scope) => parseScope(scope));
};
