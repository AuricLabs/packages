import { describe, it, expect, vi } from 'vitest';

import { getMigrations, getMigrationsSummary, getMigrationById } from './migrations';

import type { MigrationRecord, MigrationStorage } from '../../types';

function makeRecord(overrides: Partial<MigrationRecord> = {}): MigrationRecord {
  return {
    id: 'mig-1',
    name: 'test',
    status: 'completed',
    direction: 'up',
    startedAt: 1000,
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
    getRecordsByStatus: vi.fn().mockResolvedValue([]),
    getRecordsByExecutionId: vi.fn().mockResolvedValue([]),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
  };
}

describe('getMigrations', () => {
  it('returns latest record per migration sorted by createdAt desc', async () => {
    const records = [
      makeRecord({ id: 'mig-1', createdAt: 100 }),
      makeRecord({ id: 'mig-1', createdAt: 200, direction: 'down' }),
      makeRecord({ id: 'mig-2', createdAt: 300 }),
    ];
    const storage = createMockStorage(records);

    const result = await getMigrations(storage);

    expect(result).toHaveLength(2);
    // mig-2 (createdAt 300) should come first
    expect(result[0].id).toBe('mig-2');
    // mig-1 latest is the down record (createdAt 200)
    expect(result[1].id).toBe('mig-1');
    expect(result[1].direction).toBe('down');
  });

  it('returns empty array for no records', async () => {
    const storage = createMockStorage([]);
    const result = await getMigrations(storage);
    expect(result).toEqual([]);
  });

  it('strips output from list records (kept on detail records)', async () => {
    const records = [
      makeRecord({
        id: 'mig-1',
        createdAt: 100,
        description: '## intent',
        output: 'lots of log lines',
        outputTruncated: true,
      }),
    ];
    const storage = createMockStorage(records);

    const result = await getMigrations(storage);

    expect(result[0].output).toBeUndefined();
    expect(result[0].description).toBe('## intent');
    expect(result[0].outputTruncated).toBe(true);
  });
});

describe('getMigrationsSummary', () => {
  it('counts statuses correctly', async () => {
    const records = [
      makeRecord({ id: 'mig-1', status: 'completed', createdAt: 100 }),
      makeRecord({ id: 'mig-2', status: 'pending', createdAt: 200 }),
      makeRecord({ id: 'mig-3', status: 'failed', createdAt: 300 }),
      makeRecord({ id: 'mig-4', status: 'running', createdAt: 400 }),
    ];
    const storage = createMockStorage(records);

    const result = await getMigrationsSummary(storage);

    expect(result.completed).toBe(1);
    expect(result.pending).toBe(2); // pending + running
    expect(result.failed).toBe(1);
    expect(result.total).toBe(4);
  });

  it('counts rolled_back as pending (not completed)', async () => {
    const records = [makeRecord({ id: 'mig-1', status: 'rolled_back', createdAt: 100 })];
    const storage = createMockStorage(records);

    const result = await getMigrationsSummary(storage);
    expect(result.pending).toBe(1);
    expect(result.completed).toBe(0);
  });

  it('counts completed+down as pending (reverted migration)', async () => {
    const records = [
      makeRecord({ id: 'mig-1', status: 'completed', direction: 'down', createdAt: 200 }),
    ];
    const storage = createMockStorage(records);

    const result = await getMigrationsSummary(storage);
    expect(result.pending).toBe(1);
    expect(result.completed).toBe(0);
  });

  it('counts rolling_back as failed', async () => {
    const records = [makeRecord({ id: 'mig-1', status: 'rolling_back', createdAt: 100 })];
    const storage = createMockStorage(records);

    const result = await getMigrationsSummary(storage);
    expect(result.failed).toBe(1);
  });

  it('returns zeros for empty records', async () => {
    const storage = createMockStorage([]);
    const result = await getMigrationsSummary(storage);
    expect(result).toEqual({ pending: 0, completed: 0, failed: 0, total: 0 });
  });

  it('deduplicates multiple records for same migration (uses latest)', async () => {
    const records = [
      makeRecord({ id: 'mig-1', status: 'failed', createdAt: 100 }),
      makeRecord({ id: 'mig-1', status: 'completed', createdAt: 200 }),
    ];
    const storage = createMockStorage(records);

    const result = await getMigrationsSummary(storage);
    expect(result.completed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.total).toBe(1);
  });
});

describe('getMigrationById', () => {
  it('returns all records for a given id sorted by createdAt desc', async () => {
    const records = [
      makeRecord({ id: 'mig-1', createdAt: 100, direction: 'up' }),
      makeRecord({ id: 'mig-1', createdAt: 200, direction: 'down' }),
      makeRecord({ id: 'mig-2', createdAt: 300 }),
    ];
    const storage = createMockStorage(records);

    const result = await getMigrationById(storage, 'mig-1');

    expect(result).toHaveLength(2);
    expect(result[0].createdAt).toBe(200);
    expect(result[1].createdAt).toBe(100);
  });

  it('returns empty array for unknown id', async () => {
    const storage = createMockStorage([makeRecord({ id: 'mig-1' })]);
    const result = await getMigrationById(storage, 'mig-unknown');
    expect(result).toEqual([]);
  });
});
