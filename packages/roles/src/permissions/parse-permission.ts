import { parsePermissionString } from './parse-permission-string';
import { Permission, PermissionOrGroupOrString, PermissionString } from './types';

export type ParsedPermission<T extends PermissionOrGroupOrString> =
  T extends PermissionString<infer S, infer A, infer T> ? Permission<S, A, T> : T;

export const parsePermission = <T extends PermissionOrGroupOrString>(
  permission: T,
): ParsedPermission<T> => {
  if (typeof permission === 'string') {
    // @ts-expect-error this fails because the we cannot identify the exact types here
    return parsePermissionString(permission);
  }
  // @ts-expect-error this fails because the we cannot identify the exact types here
  return permission;
};
