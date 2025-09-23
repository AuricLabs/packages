import { parseScope } from './parse-scope';
import { Scope } from './types';

export const getIdFromScope = (
  scope: Scope | undefined,
  type: string | undefined,
): string | undefined => {
  if (!type || !scope) {
    return undefined;
  }
  const parsedScope = parseScope(scope);
  return parsedScope.find((s) => s.type.toLowerCase() === type.toLowerCase())?.id ?? undefined;
};
