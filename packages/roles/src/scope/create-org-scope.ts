import { Scope } from './types';

export const createOrgScope = (orgId = '') =>
  Object.freeze(['org', orgId] as const satisfies Scope);
