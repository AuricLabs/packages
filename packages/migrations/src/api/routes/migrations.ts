import { getLatestRecordPerMigration } from '../../utils/records';

import type { MigrationStorage, MigrationRecord } from '../../types';

export async function getMigrations(storage: MigrationStorage): Promise<MigrationRecord[]> {
  const allRecords = await storage.getAllRecords();
  const latestById = getLatestRecordPerMigration(allRecords);
  return Array.from(latestById.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getMigrationsSummary(
  storage: MigrationStorage,
): Promise<{ pending: number; completed: number; failed: number; total: number }> {
  const migrations = await getMigrations(storage);

  let pending = 0;
  let completed = 0;
  let failed = 0;

  for (const m of migrations) {
    if (m.status === 'completed' && m.direction === 'down') {
      // Reverted migration — count as pending (it needs to be re-applied)
      pending++;
    } else {
      switch (m.status) {
        case 'pending':
        case 'running':
          pending++;
          break;
        case 'completed':
          completed++;
          break;
        case 'rolled_back':
          pending++;
          break;
        case 'failed':
        case 'rolling_back':
          failed++;
          break;
      }
    }
  }

  return { pending, completed, failed, total: migrations.length };
}

export async function getMigrationById(
  storage: MigrationStorage,
  id: string,
): Promise<MigrationRecord[]> {
  const allRecords = await storage.getAllRecords();
  return allRecords.filter((r) => r.id === id).sort((a, b) => b.createdAt - a.createdAt);
}
