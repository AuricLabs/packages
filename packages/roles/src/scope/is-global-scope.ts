import { parseScope } from './parse-scope';
import { Scope } from './types';

/**
 * Checks if a scope is global (empty after parsing)
 * @param scope - The scope to check
 * @returns True if the scope is global
 */
export const isGlobalScope = (scope?: Scope): boolean => {
  if (!scope) return true;

  const scopeArray = parseScope(scope);
  return scopeArray.length === 0;
};
