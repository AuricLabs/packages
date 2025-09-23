import { createOrgScope } from './create-org-scope';
import { ScopeStringArray } from './types';

export const createAppScope = (appId: string, orgId?: string, ...otherParts: string[]) => {
  if (orgId !== undefined) {
    return Object.freeze([
      ...createOrgScope(orgId),
      'app',
      appId,
      ...otherParts,
    ] as const satisfies ScopeStringArray);
  }
  return Object.freeze(['app', appId, ...otherParts] as const satisfies ScopeStringArray);
};
