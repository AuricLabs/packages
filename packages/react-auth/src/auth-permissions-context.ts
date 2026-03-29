import { createContext } from 'react';

import type { Ability } from '@auriclabs/roles';

export interface PermissionsContextValue {
  ability: Ability;
  isLoading: boolean;
}

export const AuthPermissionsContext = createContext<PermissionsContextValue | null>(null);
