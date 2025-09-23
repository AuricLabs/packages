import { Scope } from './types';

export const isScope = (scope: unknown): scope is Scope => {
  return Array.isArray(scope) || typeof scope === 'string';
};
