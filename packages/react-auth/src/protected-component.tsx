import { useCanAccess } from './use-can-access';

import type { Context, PermissionOrGroupOrString } from '@auriclabs/roles';
import type { ReactNode } from 'react';

export interface ProtectedComponentProps {
  requireAll?: PermissionOrGroupOrString[];
  requireAny?: PermissionOrGroupOrString[];
  context?: Context;
  fallback?: ReactNode;
  loading?: ReactNode;
  children: ReactNode;
}

export function ProtectedComponent({
  requireAll,
  requireAny,
  context,
  fallback = null,
  loading,
  children,
}: ProtectedComponentProps) {
  const { canAccess, isLoading } = useCanAccess({ requireAll, requireAny, context });

  if (isLoading) {
    return <>{loading ?? null}</>;
  }

  if (!canAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
