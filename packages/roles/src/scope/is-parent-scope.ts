import { parseScope } from './parse-scope';
import { Scope } from './types';

// used to check if a scope is a parent of another scope
// in other words check if 1 scope is a subset of another scope
// child scope should always have stricter/more specific scope than the parent scope
export const isParentScope = (parent: Scope, child: Scope) => {
  const parentArray = parseScope(parent);
  const childArray = parseScope(child);
  if (parentArray.length > childArray.length) {
    return false;
  }
  return parentArray.every((e, index) => {
    const childElement = childArray[index];

    // Check type matching - wildcard type '*' matches any type
    const typeMatches = e.type === '*' || e.type === childElement.type;

    // Check id matching - wildcard id '*' or undefined id matches any child id
    const idMatches = e.id === '*' || e.id === undefined || e.id === childElement.id;

    return typeMatches && idMatches;
  });
};
