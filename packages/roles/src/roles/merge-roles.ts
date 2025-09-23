import { Role } from './types';

export const mergeRoles = (...roles: [Role, ...(Partial<Role> | undefined)[]]): Role => {
  return roles.slice(1).reduce<Role>((acc, role) => {
    return {
      ...acc,
      ...role,
      name: acc.name,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      permissions: [...(acc.permissions ?? []), ...(role?.permissions ?? [])],
    };
  }, roles[0]);
};
