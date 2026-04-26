import type { MigrationDirection, MigrationStorage, MigrationRecord } from '../../types';

export interface ExecutionBatch {
  executionId: string;
  startedAt: number;
  completedAt?: number;
  status: 'completed' | 'failed' | 'running';
  migrationCount: number;
  direction: MigrationDirection;
}

export async function getExecutions(storage: MigrationStorage): Promise<ExecutionBatch[]> {
  const allRecords = await storage.getAllRecords();

  const grouped = new Map<string, MigrationRecord[]>();
  for (const record of allRecords) {
    const existing = grouped.get(record.executionId) ?? [];
    existing.push(record);
    grouped.set(record.executionId, existing);
  }

  const batches: ExecutionBatch[] = [];
  for (const [executionId, records] of grouped) {
    const sorted = records.sort((a, b) => a.createdAt - b.createdAt);
    const startedAt = sorted[0].startedAt;
    const lastRecord = sorted[sorted.length - 1];
    const completedAt = lastRecord.completedAt;

    const hasFailed = records.some((r) => r.status === 'failed');
    const hasRunning = records.some((r) => r.status === 'running');
    const status = hasRunning ? 'running' : hasFailed ? 'failed' : 'completed';
    const direction = sorted[0].direction;

    batches.push({
      executionId,
      startedAt,
      completedAt,
      status,
      migrationCount: records.length,
      direction,
    });
  }

  return batches.sort((a, b) => b.startedAt - a.startedAt);
}

export async function getExecutionById(
  storage: MigrationStorage,
  executionId: string,
): Promise<MigrationRecord[]> {
  const records = await storage.getRecordsByExecutionId(executionId);
  return records.sort((a, b) => a.createdAt - b.createdAt);
}
