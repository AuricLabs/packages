export interface TimeBudget {
  startTime: number;
  elapsedMs(): number;
  remainingMs(): number;
  isExpired(): boolean;
  shouldRun(cursor?: string | null): boolean;
}

/**
 * Tracks a wall-clock budget for long-running jobs. Pair with continueJob():
 * loop while `shouldRun(cursor)` and return a continuation with the cursor
 * when the budget expires, so the next slice picks up where this one stopped.
 *
 * shouldRun treats any falsy cursor (undefined, null, '') as "no more work" —
 * cursors that mean "keep going" must be non-empty strings.
 */
export function createTimeBudget(maxDurationMs: number, now: () => number = Date.now): TimeBudget {
  const startTime = now();

  return {
    startTime,
    elapsedMs() {
      return now() - startTime;
    },
    remainingMs() {
      return Math.max(0, maxDurationMs - (now() - startTime));
    },
    isExpired() {
      return now() - startTime >= maxDurationMs;
    },
    shouldRun(cursor?: string | null) {
      return Boolean(cursor) && now() - startTime < maxDurationMs;
    },
  };
}
