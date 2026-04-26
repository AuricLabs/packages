import type { MigrationRecord } from '../types';

/**
 * Groups records by migration ID and returns the latest record per ID
 * (most recent by `createdAt`).
 */
export function getLatestRecordPerMigration(
  records: MigrationRecord[],
): Map<string, MigrationRecord> {
  const latestById = new Map<string, MigrationRecord>();

  for (const record of records) {
    const existing = latestById.get(record.id);
    if (!existing || record.createdAt > existing.createdAt) {
      latestById.set(record.id, record);
    }
  }

  return latestById;
}

/**
 * Returns the set of migration IDs whose latest record is a completed up-migration.
 */
export function getCompletedMigrationIds(records: MigrationRecord[]): Set<string> {
  const latestById = getLatestRecordPerMigration(records);
  const completedSet = new Set<string>();

  for (const [id, record] of latestById) {
    if (record.direction === 'up' && record.status === 'completed') {
      completedSet.add(id);
    }
  }

  return completedSet;
}
