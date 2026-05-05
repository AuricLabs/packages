import { describe, it, expect } from 'vitest';
import { computeRollbackPlan } from './RollbackDialog.logic';

describe('computeRollbackPlan', () => {
  it('returns empty orderedIds and zero count when no completed migrations and a real id is selected', () => {
    const plan = computeRollbackPlan([], 'mig-x');
    expect(plan.orderedIds).toEqual([]);
    expect(plan.rollbackCount).toBe(0);
    expect(plan.target).toBe('mig-x');
  });

  it("returns count=1 and undefined target for selected='last' with empty list", () => {
    const plan = computeRollbackPlan([], 'last');
    expect(plan.orderedIds).toEqual([]);
    expect(plan.rollbackCount).toBe(1);
    expect(plan.target).toBeUndefined();
  });

  it('reverses oldest-first input to newest-first orderedIds', () => {
    const plan = computeRollbackPlan(['001_a', '002_b', '003_c'], 'last');
    expect(plan.orderedIds).toEqual(['003_c', '002_b', '001_a']);
  });

  it("returns count=1 and undefined target for selected='last' regardless of list contents", () => {
    const plan = computeRollbackPlan(['001_a', '002_b', '003_c'], 'last');
    expect(plan.rollbackCount).toBe(1);
    expect(plan.target).toBeUndefined();
  });

  it('returns count=1 when newest is selected', () => {
    const plan = computeRollbackPlan(['001_a', '002_b', '003_c'], '003_c');
    expect(plan.rollbackCount).toBe(1);
    expect(plan.target).toBe('003_c');
  });

  it('returns count=2 when middle migration is selected', () => {
    const plan = computeRollbackPlan(['001_a', '002_b', '003_c'], '002_b');
    expect(plan.rollbackCount).toBe(2);
    expect(plan.target).toBe('002_b');
  });

  it('returns count=N when oldest is selected (rolls back everything)', () => {
    const plan = computeRollbackPlan(['001_a', '002_b', '003_c'], '001_a');
    expect(plan.rollbackCount).toBe(3);
    expect(plan.target).toBe('001_a');
  });

  it('returns count=0 when selection is not present in completedIds', () => {
    const plan = computeRollbackPlan(['001_a', '002_b', '003_c'], 'missing');
    expect(plan.rollbackCount).toBe(0);
    expect(plan.target).toBe('missing');
  });

  it('does not mutate the input completedIds array', () => {
    const completed = ['001_a', '002_b', '003_c'];
    const snapshot = [...completed];
    computeRollbackPlan(completed, '002_b');
    expect(completed).toEqual(snapshot);
  });
});
