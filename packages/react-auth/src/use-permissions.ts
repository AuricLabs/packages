import { useContext } from 'react';

import { AuthPermissionsContext, type PermissionsContextValue } from './auth-permissions-context';

export type { PermissionsContextValue };

export function usePermissions(): PermissionsContextValue {
  const context = useContext(AuthPermissionsContext);
  if (context === null) {
    throw new Error('usePermissions must be used within an <AuthPermissionsProvider>');
  }
  return context;
}
