import { createTimeBudget } from './time-budget';

describe('createTimeBudget', () => {
  it('tracks elapsed and remaining time', () => {
    let time = 1000;
    const budget = createTimeBudget(500, () => time);

    expect(budget.startTime).toBe(1000);
    expect(budget.elapsedMs()).toBe(0);
    expect(budget.remainingMs()).toBe(500);
    expect(budget.isExpired()).toBe(false);

    time = 1300;
    expect(budget.elapsedMs()).toBe(300);
    expect(budget.remainingMs()).toBe(200);
    expect(budget.isExpired()).toBe(false);

    time = 1500;
    expect(budget.isExpired()).toBe(true);
    expect(budget.remainingMs()).toBe(0);

    time = 2000;
    expect(budget.remainingMs()).toBe(0);
  });

  describe('shouldRun', () => {
    it('runs while a cursor exists and the budget remains', () => {
      let time = 0;
      const budget = createTimeBudget(500, () => time);

      expect(budget.shouldRun('cursor-1')).toBe(true);

      time = 499;
      expect(budget.shouldRun('cursor-1')).toBe(true);

      time = 500;
      expect(budget.shouldRun('cursor-1')).toBe(false);
    });

    it('stops when the cursor is exhausted', () => {
      const budget = createTimeBudget(500, () => 0);

      expect(budget.shouldRun(undefined)).toBe(false);
      expect(budget.shouldRun(null)).toBe(false);
      expect(budget.shouldRun('')).toBe(false);
    });
  });

  it('defaults to Date.now', () => {
    const budget = createTimeBudget(60_000);
    expect(budget.isExpired()).toBe(false);
    expect(budget.elapsedMs()).toBeLessThan(1000);
  });
});
