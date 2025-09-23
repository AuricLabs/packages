import { isMatch } from 'lodash';
import sift from 'sift';

import { Context, Permission } from '../permissions';
import { createScopeRegex, isScope, stringifyScope } from '../scope';

export const createPermissionTest = (permission: Permission) => {
  const scopeTest = permission.scope ? createScopeRegex(permission.scope) : undefined;
  const contextTest = permission.conditions ? sift(permission.conditions) : undefined;
  const actions = Array.isArray(permission.action) ? permission.action : [permission.action];
  const subjects = Array.isArray(permission.subject) ? permission.subject : [permission.subject];
  const globalAction = actions.includes('manage');
  const globalSubject = subjects.includes('all');

  return (testPermission: Permission, context?: Context): boolean => {
    const scopeIsValid =
      isScope(testPermission.scope) && scopeTest
        ? scopeTest.test(stringifyScope(testPermission.scope))
        : true;
    const contextIsValid = () => (contextTest && context ? contextTest(context) : true);
    const hasAllActions = () =>
      globalAction ||
      (Array.isArray(testPermission.action)
        ? testPermission.action.every((action) => actions.includes(action))
        : actions.includes(testPermission.action));
    const hasAllSubjects = () =>
      globalSubject ||
      (Array.isArray(testPermission.subject)
        ? testPermission.subject.every((subject) => subjects.includes(subject))
        : subjects.includes(testPermission.subject));
    const conditionsMatch = () =>
      permission.conditions && testPermission.conditions
        ? isMatch(permission.conditions, testPermission.conditions)
        : true;

    /**
     * Execute them as methods so that we optimise for performance.
     */
    if ((permission.type ?? 'can') === (testPermission.type ?? 'can')) {
      return (
        scopeIsValid && hasAllActions() && hasAllSubjects() && contextIsValid() && conditionsMatch()
      );
    } else {
      return (
        !scopeIsValid ||
        !hasAllActions() ||
        !hasAllSubjects() ||
        !contextIsValid() ||
        !conditionsMatch()
      );
    }
  };
};
