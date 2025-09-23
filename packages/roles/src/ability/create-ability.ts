import { Context, flattenPermissions, Permission, PermissionOrGroupOrString } from '../permissions';

import { createPermissionTest } from './create-permission-test';
import { flattenActionSubjects } from './flatten-action-subjects';

export interface Ability {
  permissions: readonly PermissionOrGroupOrString[];
  test: (permission: Permission, context?: Context) => boolean;
  has(
    permission: readonly PermissionOrGroupOrString[] | PermissionOrGroupOrString,
    context?: Context,
  ): boolean;
  hasAny(permission: readonly PermissionOrGroupOrString[], context?: Context): boolean;
  hasAll(permission: readonly PermissionOrGroupOrString[], context?: Context): boolean;
}

export const createAbility = (abilityPermissions: PermissionOrGroupOrString[]): Ability => {
  const flattenedPermissions = flattenPermissions(abilityPermissions);
  const canTests = flattenedPermissions
    .filter((p) => p.type === 'can' || p.type === undefined)
    .map(createPermissionTest);
  const cannotTests = flattenedPermissions
    .filter((p) => p.type === 'cannot')
    .map(createPermissionTest);
  const test = (permission: Permission, context?: Context) =>
    flattenActionSubjects(permission).every((p) =>
      p.type === 'cannot'
        ? cannotTests.some((testCannot) => testCannot(p, context)) ||
          canTests.every((testCan) => testCan(p, context))
        : cannotTests.every((testCannot) => testCannot(p, context)) &&
          canTests.some((testCan) => testCan(p, context)),
    );

  return {
    permissions: abilityPermissions,
    test,
    has(permission: PermissionOrGroupOrString, context?: Context) {
      return this.hasAll(Array.isArray(permission) ? permission : [permission], context);
    },
    hasAny(permissions: readonly PermissionOrGroupOrString[], context?: Context) {
      return flattenPermissions(permissions).some((p) => test(p, context));
    },
    hasAll(permissions: readonly PermissionOrGroupOrString[], context?: Context) {
      return flattenPermissions(permissions).every((p) => test(p, context));
    },
  };
};
