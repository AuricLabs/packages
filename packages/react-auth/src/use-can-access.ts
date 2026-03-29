import { useMemo } from 'react';

import { usePermissions } from './use-permissions';

import type { Context, PermissionOrGroupOrString } from '@auriclabs/roles';

export interface UseCanAccessOptions {
  requireAll?: PermissionOrGroupOrString[];
  requireAny?: PermissionOrGroupOrString[];
  context?: Context;
}

export interface UseCanAccessResult {
  canAccess: boolean;
  canAccessAll: boolean;
  canAccessAny: boolean;
  isLoading: boolean;
}

export function useCanAccess({
  requireAll,
  requireAny,
  context,
}: UseCanAccessOptions): UseCanAccessResult {
  const { ability, isLoading } = usePermissions();

  return useMemo(() => {
    if (isLoading) {
      return {
        canAccess: false,
        canAccessAll: false,
        canAccessAny: false,
        isLoading: true,
      };
    }

    const canAccessAll = requireAll?.length ? ability.hasAll(requireAll, context) : true;
    const canAccessAny = requireAny?.length ? ability.hasAny(requireAny, context) : true;
    const canAccess = canAccessAll && canAccessAny;

    return { canAccess, canAccessAll, canAccessAny, isLoading: false };
  }, [ability, isLoading, requireAll, requireAny, context]);
}
