import { describe, expect, it, vi, beforeEach } from 'vitest';

import { DynamoDBMigrationStorage } from './dynamodb-storage';

import type { MigrationRecord } from '../../types';

// Hoisted by Vitest above the import.
vi.mock('sst', () => ({
  Resource: {},
}));

/**
 * Regression coverage for the marshaling layer between the typed
 * `MigrationRecord` and the ElectroDB entity. The storage adapter must
 * pass `description`, `output`, and `outputTruncated` through to put/patch
 * and read them back via the toMigrationRecord mapper — otherwise the
 * dashboard receives empty rows even though the runner captured the data.
 */
describe('DynamoDBMigrationStorage marshaling', () => {
  let storage: DynamoDBMigrationStorage;
  let putSpy: ReturnType<typeof vi.fn>;
  let patchSet: ReturnType<typeof vi.fn>;
  let patchGo: ReturnType<typeof vi.fn>;
  let scanGo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    storage = new DynamoDBMigrationStorage({ tableName: 'test' });

    putSpy = vi.fn().mockReturnValue({
      go: vi.fn().mockResolvedValue({
        data: makeFullDdbItem(),
      }),
    });

    patchGo = vi.fn().mockResolvedValue({ data: makeFullDdbItem() });
    patchSet = vi.fn().mockReturnValue({ go: patchGo });

    scanGo = vi.fn().mockResolvedValue({ data: [makeFullDdbItem()], cursor: null });

    // Replace the internal entity with a hand-rolled mock that records
    // every put/patch invocation so the test can assert on the arg shape.
    interface EntityShape {
      put: typeof putSpy;
      patch: () => { set: typeof patchSet };
      scan: { go: typeof scanGo };
    }
    (storage as unknown as { entity: EntityShape }).entity = {
      put: putSpy,
      patch: () => ({ set: patchSet }),
      scan: { go: scanGo },
    };
  });

  it('passes description, output, and outputTruncated through createRecord', async () => {
    const record: Omit<MigrationRecord, 'createdAt' | 'updatedAt'> = {
      id: 'mig-1',
      name: 'mig-1',
      status: 'running',
      direction: 'up',
      startedAt: 1000,
      executionId: 'exec-1',
      description: '## what this does',
      output: '[2026-01-01] [info] starting',
      outputTruncated: true,
    };

    await storage.createRecord(record);

    expect(putSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        description: '## what this does',
        output: '[2026-01-01] [info] starting',
        outputTruncated: true,
      }),
    );
  });

  it('passes output and outputTruncated through updateRecord', async () => {
    await storage.updateRecord('mig-1', 'up', 'exec-1', {
      status: 'completed',
      output: '[done]',
      outputTruncated: true,
    });

    expect(patchSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        output: '[done]',
        outputTruncated: true,
      }),
    );
  });

  it('returns description, output, and outputTruncated from toMigrationRecord', async () => {
    const records = await storage.getAllRecords();

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      description: '## what this does',
      output: '[done]',
      outputTruncated: true,
    });
  });

  it('omits unset fields rather than writing undefined keys', async () => {
    await storage.updateRecord('mig-1', 'up', 'exec-1', {
      status: 'completed',
      // description / output / outputTruncated intentionally omitted
    });

    const args = patchSet.mock.calls[0][0] as Record<string, unknown>;
    expect(args).not.toHaveProperty('description');
    expect(args).not.toHaveProperty('output');
    expect(args).not.toHaveProperty('outputTruncated');
  });
});

function makeFullDdbItem(): Record<string, unknown> {
  return {
    id: 'mig-1',
    name: 'mig-1',
    status: 'completed',
    direction: 'up',
    startedAt: 1000,
    completedAt: 2000,
    duration: 1000,
    executionId: 'exec-1',
    description: '## what this does',
    output: '[done]',
    outputTruncated: true,
    createdAt: 1000,
    updatedAt: 2000,
  };
}
