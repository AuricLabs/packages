import escapeRegex from 'escape-string-regexp';

import { stringifyScope } from './stringify-scope';
import { Scope } from './types';

export function createScopeRegex(scope: Scope) {
  const scopeStr = stringifyScope(scope);

  // Order matters: replace ** before single * to avoid conflicts
  const pattern = escapeRegex(scopeStr)
    .replace(/:\\\*\\\*/g, ':.*') // :** → :.* (matches any colon-separated segments after the prefix)
    .replace(/\\\*/g, '[^:]*'); // * → [^:]* (single segment, doesn't cross colons)

  // Use exact matching by default (with $)
  return new RegExp(`^${pattern}$`);
}
