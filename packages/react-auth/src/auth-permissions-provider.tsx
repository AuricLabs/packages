import { createAbility, type PermissionOrGroupOrString } from '@auriclabs/roles';
import { useMemo, type ReactNode } from 'react';

import { AuthPermissionsContext } from './auth-permissions-context';

export interface AuthPermissionsProviderProps {
  permissions: PermissionOrGroupOrString[];
  isLoading?: boolean;
  children: ReactNode;
}

export function AuthPermissionsProvider({
  permissions,
  isLoading = false,
  children,
}: AuthPermissionsProviderProps) {
  const ability = useMemo(() => createAbility(permissions), [permissions]);
  const value = useMemo(() => ({ ability, isLoading }), [ability, isLoading]);

  return (
    <AuthPermissionsContext.Provider value={value}>{children}</AuthPermissionsContext.Provider>
  );
}
