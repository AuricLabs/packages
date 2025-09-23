import { ScopeSubject } from './types';

/**
 * Checks if the subject is a valid ScopeSubject.
 *
 * @param subject - The subject to check.
 * @returns True if the subject is a valid ScopeSubject, false otherwise.
 */
export const isScopeSubject = (subject: unknown): subject is ScopeSubject => {
  if (typeof subject !== 'object' || subject === null) return false;
  const obj = subject as Record<string, unknown>;
  if (typeof obj.type !== 'string') return false;
  if ('id' in obj && obj.id !== undefined && typeof obj.id !== 'string') return false;
  return true;
};
