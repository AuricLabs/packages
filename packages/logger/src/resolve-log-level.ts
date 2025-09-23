import { isLocal, isNonProd } from '@auriclabs/env';

import { ALLOWED_LOG_LEVELS } from './constants';

/**
 * Resolves and validates the log level from environment variables
 * Normalizes uppercase values and provides safe fallbacks
 */
export const resolveLogLevel = (): string => {
  const envLogLevel =
    typeof process !== 'undefined'
      ? process.env.LOG_LEVEL
      : (import.meta as unknown as { env?: { LOG_LEVEL: string } }).env?.LOG_LEVEL;

  if (envLogLevel) {
    const normalizedLevel = envLogLevel.toLowerCase();
    if (ALLOWED_LOG_LEVELS.includes(normalizedLevel as (typeof ALLOWED_LOG_LEVELS)[number])) {
      return normalizedLevel;
    }
  }

  // Safe fallback based on environment
  return isLocal() ? 'trace' : isNonProd() ? 'debug' : 'info';
};
