import { parseScope } from './parse-scope';
import { scopeKeyId } from './scope-key-id';
import { Scope } from './types';

/**
 * Parses the scope ids from the scope string.
 * @param scope - The scope string to parse.
 * @param keys - The keys to parse.
 * @returns The parsed scope ids.
 */
export function parseScopeIds(scope?: Scope): Record<string, string | undefined>;
export function parseScopeIds<T extends [string, ...string[]]>(
  scope?: Scope,
  ...keys: T
): Record<`${T[number]}Id`, string>;
export function parseScopeIds<T extends string[]>(
  scope: Scope | undefined = [],
  ...keys: T
): Record<`${T[number]}Id`, string | undefined> {
  const result = {} as Record<`${T[number]}Id`, string | undefined>;

  scope = parseScope(scope);
  scope.forEach(({ type, id }) => {
    result[scopeKeyId(type as T[number])] = id;
  });

  if (!keys.length) {
    return result;
  }

  const validatedResult = {} as Record<`${T[number]}Id`, string | undefined>;
  for (const key of keys) {
    const keyId = scopeKeyId(key as T[number]);
    const id = result[keyId];
    if (id !== undefined) {
      validatedResult[keyId] = id;
    } else {
      throw new Error(`${key} is not defined in scope`);
    }
  }

  return validatedResult;
}
