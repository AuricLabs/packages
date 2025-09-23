import escapeRegex from 'escape-string-regexp';

import { stringifyScope } from './stringify-scope';
import { Scope } from './types';

export function createScopeRegex(scope: Scope) {
  return new RegExp(`^${escapeRegex(stringifyScope(scope)).replace(/\\\*/g, '[^:]*')}`);
}
