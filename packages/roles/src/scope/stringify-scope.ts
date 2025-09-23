import { get } from 'lodash';

import { Scope, ScopeString, ScopeSubject } from './types';

export const stringifyScope = (
  scope?: Scope,
  context: Record<string, unknown> = {},
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

  // find all instances of a {variable} and replace with the value from the get(context)
  result = result.replace(/{(.+?)}/g, (match, p1) => {
    return String(get(context, p1, match));
  });

  return result.toLowerCase() as ScopeString;
};
