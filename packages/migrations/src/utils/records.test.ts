import { describe, it, expect } from 'vitest';

import { getLatestRecordPerMigration, getCompletedMigrationIds } from './records';

import type { MigrationRecord } from '../types';

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

describe('getLatestRecordPerMigration', () => {
  it('returns empty map for empty input', () => {
    const result = getLatestRecordPerMigration([]);
    expect(result.size).toBe(0);
  });

  it('returns one entry per unique migration id', () => {
    const records = [
      makeRecord({ id: 'mig-1', createdAt: 100 }),
      makeRecord({ id: 'mig-2', createdAt: 200 }),
    ];
    const result = getLatestRecordPerMigration(records);
    expect(result.size).toBe(2);
    expect(result.has('mig-1')).toBe(true);
    expect(result.has('mig-2')).toBe(true);
  });

  it('keeps the record with the latest createdAt for duplicates', () => {
    const older = makeRecord({ id: 'mig-1', createdAt: 100, status: 'failed' });
    const newer = makeRecord({ id: 'mig-1', createdAt: 200, status: 'completed' });
    const result = getLatestRecordPerMigration([older, newer]);

    expect(result.get('mig-1')?.status).toBe('completed');
    expect(result.get('mig-1')?.createdAt).toBe(200);
  });

  it('handles records in any order', () => {
    const records = [
      makeRecord({ id: 'mig-1', createdAt: 300, direction: 'down' }),
      makeRecord({ id: 'mig-1', createdAt: 100, direction: 'up' }),
      makeRecord({ id: 'mig-1', createdAt: 200, direction: 'up' }),
    ];
    const result = getLatestRecordPerMigration(records);
    expect(result.get('mig-1')?.createdAt).toBe(300);
    expect(result.get('mig-1')?.direction).toBe('down');
  });

  it('keeps first record when createdAt values are identical', () => {
    const first = makeRecord({ id: 'mig-1', createdAt: 100, status: 'completed' });
    const second = makeRecord({ id: 'mig-1', createdAt: 100, status: 'failed' });
    const result = getLatestRecordPerMigration([first, second]);

    // Neither is strictly greater, so the first one encountered wins
    expect(result.get('mig-1')?.status).toBe('completed');
  });
});

describe('getCompletedMigrationIds', () => {
  it('returns empty set for empty input', () => {
    const result = getCompletedMigrationIds([]);
    expect(result.size).toBe(0);
  });

  it('includes ids where latest record is direction=up and status=completed', () => {
    const records = [
      makeRecord({ id: 'mig-1', status: 'completed', direction: 'up', createdAt: 100 }),
      makeRecord({ id: 'mig-2', status: 'completed', direction: 'up', createdAt: 100 }),
    ];
    const result = getCompletedMigrationIds(records);
    expect(result).toEqual(new Set(['mig-1', 'mig-2']));
  });

  it('excludes ids where latest record is a down migration', () => {
    const records = [
      makeRecord({ id: 'mig-1', status: 'completed', direction: 'up', createdAt: 100 }),
      makeRecord({ id: 'mig-1', status: 'completed', direction: 'down', createdAt: 200 }),
    ];
    const result = getCompletedMigrationIds(records);
    expect(result.size).toBe(0);
  });

  it('excludes ids where latest record has failed status', () => {
    const records = [
      makeRecord({ id: 'mig-1', status: 'failed', direction: 'up', createdAt: 100 }),
    ];
    const result = getCompletedMigrationIds(records);
    expect(result.size).toBe(0);
  });

  it('excludes ids where latest record has running status', () => {
    const records = [
      makeRecord({ id: 'mig-1', status: 'running', direction: 'up', createdAt: 100 }),
    ];
    const result = getCompletedMigrationIds(records);
    expect(result.size).toBe(0);
  });

  it('handles mixed migrations correctly', () => {
    const records = [
      // mig-1: completed up, then rolled back
      makeRecord({ id: 'mig-1', status: 'completed', direction: 'up', createdAt: 100 }),
      makeRecord({ id: 'mig-1', status: 'completed', direction: 'down', createdAt: 200 }),
      // mig-2: completed up
      makeRecord({ id: 'mig-2', status: 'completed', direction: 'up', createdAt: 100 }),
      // mig-3: failed
      makeRecord({ id: 'mig-3', status: 'failed', direction: 'up', createdAt: 100 }),
    ];
    const result = getCompletedMigrationIds(records);
    expect(result).toEqual(new Set(['mig-2']));
  });
});
