import { describe, it, expect, vi } from 'vitest';

import { getExecutions, getExecutionById } from './executions';

import type { MigrationRecord, MigrationStorage } from '../../types';

function makeRecord(overrides: Partial<MigrationRecord> = {}): MigrationRecord {
  return {
    id: 'mig-1',
    name: 'test',
    status: 'completed',
    direction: 'up',
    startedAt: 1000,
    completedAt: 2000,
    executionId: 'exec-1',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function createMockStorage(records: MigrationRecord[] = []): MigrationStorage {
  return {
    getRecord: vi.fn(),
    getAllRecords: vi.fn().mockResolvedValue(records),
    getRecordsByStatus: vi.fn(),
    getRecordsByExecutionId: vi.fn().mockResolvedValue([]),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
  };
}

describe('getExecutions', () => {
  it('groups records by executionId', async () => {
    const records = [
      makeRecord({ id: 'mig-1', executionId: 'exec-1', startedAt: 1000, createdAt: 1000 }),
      makeRecord({ id: 'mig-2', executionId: 'exec-1', startedAt: 1001, createdAt: 1001 }),
      makeRecord({ id: 'mig-3', executionId: 'exec-2', startedAt: 2000, createdAt: 2000 }),
    ];
    const storage = createMockStorage(records);

    const result = await getExecutions(storage);

    expect(result).toHaveLength(2);
  });

  it('returns batches sorted by startedAt desc (newest first)', async () => {
    const records = [
      makeRecord({ id: 'mig-1', executionId: 'exec-old', startedAt: 1000, createdAt: 1000 }),
      makeRecord({ id: 'mig-2', executionId: 'exec-new', startedAt: 2000, createdAt: 2000 }),
    ];
    const storage = createMockStorage(records);

    const result = await getExecutions(storage);

    expect(result[0].executionId).toBe('exec-new');
    expect(result[1].executionId).toBe('exec-old');
  });

  it('calculates batch status as failed when any record failed', async () => {
    const records = [
      makeRecord({ id: 'mig-1', executionId: 'exec-1', status: 'completed', createdAt: 1000 }),
      makeRecord({ id: 'mig-2', executionId: 'exec-1', status: 'failed', createdAt: 1001 }),
    ];
    const storage = createMockStorage(records);

    const result = await getExecutions(storage);

    expect(result[0].status).toBe('failed');
  });

  it('calculates batch status as running when any record is running', async () => {
    const records = [
      makeRecord({ id: 'mig-1', executionId: 'exec-1', status: 'completed', createdAt: 1000 }),
      makeRecord({ id: 'mig-2', executionId: 'exec-1', status: 'running', createdAt: 1001 }),
    ];
    const storage = createMockStorage(records);

    const result = await getExecutions(storage);

    expect(result[0].status).toBe('running');
  });

  it('running takes priority over failed', async () => {
    const records = [
      makeRecord({ id: 'mig-1', executionId: 'exec-1', status: 'failed', createdAt: 1000 }),
      makeRecord({ id: 'mig-2', executionId: 'exec-1', status: 'running', createdAt: 1001 }),
    ];
    const storage = createMockStorage(records);

    const result = await getExecutions(storage);

    expect(result[0].status).toBe('running');
  });

  it('calculates batch status as completed when all records completed', async () => {
    const records = [
      makeRecord({ id: 'mig-1', executionId: 'exec-1', status: 'completed', createdAt: 1000 }),
      makeRecord({ id: 'mig-2', executionId: 'exec-1', status: 'completed', createdAt: 1001 }),
    ];
    const storage = createMockStorage(records);

    const result = await getExecutions(storage);

    expect(result[0].status).toBe('completed');
  });

  it('includes migrationCount', async () => {
    const records = [
      makeRecord({ id: 'mig-1', executionId: 'exec-1', createdAt: 1000 }),
      makeRecord({ id: 'mig-2', executionId: 'exec-1', createdAt: 1001 }),
      makeRecord({ id: 'mig-3', executionId: 'exec-1', createdAt: 1002 }),
    ];
    const storage = createMockStorage(records);

    const result = await getExecutions(storage);

    expect(result[0].migrationCount).toBe(3);
  });

  it('returns empty array for no records', async () => {
    const storage = createMockStorage([]);
    const result = await getExecutions(storage);
    expect(result).toEqual([]);
  });

  it('returns direction field from first sorted record', async () => {
    const records = [
      makeRecord({ id: 'mig-1', executionId: 'exec-1', direction: 'down', createdAt: 1000 }),
    ];
    const storage = createMockStorage(records);

    const result = await getExecutions(storage);

    expect(result[0].direction).toBe('down');
  });

  it('returns completedAt from last sorted record', async () => {
    const records = [
      makeRecord({ id: 'mig-1', executionId: 'exec-1', completedAt: 1500, createdAt: 1000 }),
      makeRecord({ id: 'mig-2', executionId: 'exec-1', completedAt: 2500, createdAt: 2000 }),
    ];
    const storage = createMockStorage(records);

    const result = await getExecutions(storage);

    expect(result[0].completedAt).toBe(2500);
  });

  it('handles single-record batch', async () => {
    const records = [
      makeRecord({
        id: 'mig-1',
        executionId: 'exec-1',
        startedAt: 1000,
        completedAt: 1500,
        createdAt: 1000,
      }),
    ];
    const storage = createMockStorage(records);

    const result = await getExecutions(storage);

    expect(result).toHaveLength(1);
    expect(result[0].migrationCount).toBe(1);
    expect(result[0].startedAt).toBe(1000);
    expect(result[0].completedAt).toBe(1500);
  });
});

describe('getExecutionById', () => {
  it('returns records for a given executionId sorted by createdAt asc', async () => {
    const records = [
      makeRecord({ id: 'mig-2', executionId: 'exec-1', createdAt: 2000 }),
      makeRecord({ id: 'mig-1', executionId: 'exec-1', createdAt: 1000 }),
    ];
    const storage = createMockStorage();
    vi.mocked(storage.getRecordsByExecutionId).mockResolvedValue(records);

    const result = await getExecutionById(storage, 'exec-1');

    expect(result[0].createdAt).toBe(1000);
    expect(result[1].createdAt).toBe(2000);
  });

  it('returns empty array for unknown executionId', async () => {
    const storage = createMockStorage();
    vi.mocked(storage.getRecordsByExecutionId).mockResolvedValue([]);

    const result = await getExecutionById(storage, 'exec-unknown');
    expect(result).toEqual([]);
  });
});
