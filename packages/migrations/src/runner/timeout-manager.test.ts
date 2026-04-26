import { describe, it, expect } from 'vitest';

import { createLambdaTimeoutManager } from './timeout-manager';

describe('createLambdaTimeoutManager', () => {
  it('returns a TimeoutManager object', () => {
    const manager = createLambdaTimeoutManager(() => 120_000);
    expect(manager).toHaveProperty('shouldStop');
    expect(manager).toHaveProperty('getRemainingTimeMs');
    expect(manager).toHaveProperty('threshold');
  });

  it('uses default threshold of 60 seconds', () => {
    const manager = createLambdaTimeoutManager(() => 120_000);
    expect(manager.threshold).toBe(60_000);
  });

  it('accepts custom threshold', () => {
    const manager = createLambdaTimeoutManager(() => 120_000, 30_000);
    expect(manager.threshold).toBe(30_000);
  });

  it('shouldStop returns false when remaining time exceeds threshold', () => {
    const manager = createLambdaTimeoutManager(() => 120_000, 60_000);
    expect(manager.shouldStop()).toBe(false);
  });

  it('shouldStop returns true when remaining time is at threshold', () => {
    const manager = createLambdaTimeoutManager(() => 60_000, 60_000);
    expect(manager.shouldStop()).toBe(true);
  });

  it('shouldStop returns true when remaining time is below threshold', () => {
    const manager = createLambdaTimeoutManager(() => 30_000, 60_000);
    expect(manager.shouldStop()).toBe(true);
  });

  it('getRemainingTimeMs delegates to the provided function', () => {
    let remaining = 120_000;
    const manager = createLambdaTimeoutManager(() => remaining);

    expect(manager.getRemainingTimeMs()).toBe(120_000);

    remaining = 50_000;
    expect(manager.getRemainingTimeMs()).toBe(50_000);
  });

  it('shouldStop reflects changing remaining time', () => {
    let remaining = 120_000;
    const manager = createLambdaTimeoutManager(() => remaining, 60_000);

    expect(manager.shouldStop()).toBe(false);

    remaining = 30_000;
    expect(manager.shouldStop()).toBe(true);
  });
});
