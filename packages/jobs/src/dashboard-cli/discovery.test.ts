import { describe, expect, it, vi } from 'vitest';

import { findTable } from './discovery';

import type { DynamoDBClient } from '@aws-sdk/client-dynamodb';

interface FakeDdbPage {
  TableNames?: string[];
  LastEvaluatedTableName?: string;
}

function createFakeDdbClient(pages: FakeDdbPage[]): DynamoDBClient {
  let i = 0;
  return {
    send: vi.fn().mockImplementation(() => Promise.resolve(pages[i++] ?? {})),
  } as unknown as DynamoDBClient;
}

describe('findTable', () => {
  it('returns override directly without listing', async () => {
    const client = createFakeDdbClient([]);
    const result = await findTable(client, { override: 'explicit-table' });
    expect(result).toBe('explicit-table');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(client.send).not.toHaveBeenCalled();
  });

  it('returns the unique match without prompting', async () => {
    const client = createFakeDdbClient([
      { TableNames: ['unrelated-table', 'alfe-dev-JobTable-x'] },
    ]);
    const selectFn = vi.fn();
    const result = await findTable(client, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      selectFn: selectFn as unknown as Parameters<typeof findTable>[1]['selectFn'],
    });
    expect(result).toBe('alfe-dev-JobTable-x');
    expect(selectFn).not.toHaveBeenCalled();
  });

  it('paginates ListTables across LastEvaluatedTableName', async () => {
    const client = createFakeDdbClient([
      { TableNames: ['unrelated'], LastEvaluatedTableName: 'unrelated' },
      { TableNames: ['something-JobTable'] },
    ]);
    const result = await findTable(client);
    expect(result).toBe('something-JobTable');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(client.send).toHaveBeenCalledTimes(2);
  });

  it('prompts when multiple matches', async () => {
    const client = createFakeDdbClient([
      { TableNames: ['alfe-dev-JobTable', 'alfe-prod-JobTable'] },
    ]);
    const selectFn = vi.fn().mockResolvedValue('alfe-prod-JobTable');
    const result = await findTable(client, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      selectFn: selectFn as unknown as Parameters<typeof findTable>[1]['selectFn'],
    });
    expect(result).toBe('alfe-prod-JobTable');
    expect(selectFn).toHaveBeenCalledTimes(1);
  });

  it('throws when zero matches', async () => {
    const client = createFakeDdbClient([{ TableNames: ['unrelated'] }]);
    await expect(findTable(client)).rejects.toThrow(/No DynamoDB tables matching/);
  });
});
