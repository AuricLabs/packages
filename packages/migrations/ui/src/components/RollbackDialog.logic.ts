export interface RollbackPlan {
  orderedIds: string[];
  rollbackCount: number;
  target: string | undefined;
}

export function computeRollbackPlan(
  completedIds: string[],
  selected: string,
): RollbackPlan {
  const orderedIds = [...completedIds].reverse();
  if (selected === 'last') {
    return { orderedIds, rollbackCount: 1, target: undefined };
  }
  const idx = orderedIds.indexOf(selected);
  return {
    orderedIds,
    rollbackCount: idx === -1 ? 0 : idx + 1,
    target: selected,
  };
}
