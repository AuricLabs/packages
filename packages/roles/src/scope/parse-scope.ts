import { isScopeSubject } from './is-scope-subject';
import { Scope, ScopeStringArray, ScopeSubject, ScopeSubjectArray } from './types';

export const parseScope = (scope?: Scope): ScopeSubjectArray => {
  if (!scope) {
    return [];
  }

  if (Array.isArray(scope) && scope.every(isScopeSubject)) {
    return scope;
  }

  // Make this type not readonly by using string[]
  let scopeStringArray: ScopeStringArray = [];

  if (typeof scope === 'string') {
    scopeStringArray = scope
      .toLowerCase()
      .split(':')
      .map((s) => s.trim()) as unknown as ScopeStringArray;
  } else if (Array.isArray(scope) && scope.every((s) => typeof s === 'string')) {
    scopeStringArray = scope.map((s) => s.toLowerCase().trim()) as unknown as ScopeStringArray;
  } else {
    throw new Error(
      'Unsupported scope type ' +
        typeof scope +
        '\n' +
        JSON.stringify(scope) +
        '. Scope must be a string or an array of strings or an array of ScopeSubjects.',
    );
  }
  const scopeSubjects: ScopeSubject[] = [];

  for (let i = 0; i < scopeStringArray.length; i += 2) {
    if (!scopeStringArray[i]) {
      throw new Error(
        'Invalid scope string array: ' +
          JSON.stringify(scopeStringArray) +
          '. Scope must be a string or an array of strings or an array of ScopeSubjects.',
      );
    }
    scopeSubjects.push({
      type: scopeStringArray[i],
      id: scopeStringArray[i + 1] || undefined,
    });
  }

  return scopeSubjects as ScopeSubjectArray;
};
