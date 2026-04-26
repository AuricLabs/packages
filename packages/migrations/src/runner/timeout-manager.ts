import type { TimeoutManager } from '../types';

const DEFAULT_THRESHOLD_MS = 60_000;

export function createLambdaTimeoutManager(
  getRemainingTimeInMillis: () => number,
  thresholdMs = DEFAULT_THRESHOLD_MS,
): TimeoutManager {
  return {
    threshold: thresholdMs,
    getRemainingTimeMs: getRemainingTimeInMillis,
    shouldStop() {
      return getRemainingTimeInMillis() <= thresholdMs;
    },
  };
}
