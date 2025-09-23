import { Scope, ScopeString, ScopeSubject } from './types';

export const stringifyScope = (
  scope?: Scope,
  variables: Record<string, string | undefined> = {},
): ScopeString => {
  if (!scope) {
    return '';
  }

  let result: string;
  if (Array.isArray(scope)) {
    result = scope
      .map((s: string | ScopeSubject, index) =>
        typeof s === 'string'
          ? s
          : `${s.type}${s.id || index < scope.length - 1 ? ':' : ''}${s.id ?? ''}`,
      )
      .join(':');
  } else if (typeof scope === 'string') {
    result = scope;
  } else {
    throw new Error('Unsupported scope type ' + typeof scope + '\n' + JSON.stringify(scope));
  }

  Object.entries(variables).forEach(([key, value]) => {
    if (value) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value);
    }
  });

  return result.toLowerCase() as ScopeString;
};
