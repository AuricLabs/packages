import { Permission, Subject } from '../permissions';
import { parseScope, Scope, scopeKeyId } from '../scope';

export const extractScopePermissions = (scope?: Scope) => {
  const scopeArray = parseScope(scope);
  const scopePermissions: Permission[] = [];

  scopeArray.forEach(({ type, id }, index) => {
    scopePermissions.push({
      subject: type as Subject,
      action: 'read',
      conditions: id ? { [scopeKeyId(type)]: id } : undefined,
      scope: scopeArray.slice(0, index + 1),
    });
  });

  return scopePermissions;
};
