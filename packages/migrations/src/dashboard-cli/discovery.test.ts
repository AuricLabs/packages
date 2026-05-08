import { describe, expect, it, vi } from 'vitest';

import { findFunction, findTable } from './discovery';

import type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { LambdaClient } from '@aws-sdk/client-lambda';

interface FakeLambdaPage {
  Functions?: { FunctionName?: string }[];
  NextMarker?: string;
}

function createFakeLambdaClient(pages: FakeLambdaPage[]): LambdaClient {
  let i = 0;
  return {
    send: vi.fn().mockImplementation(() => Promise.resolve(pages[i++] ?? {})),
  } as unknown as LambdaClient;
}

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

describe('findFunction', () => {
  it('returns override directly without listing', async () => {
    const client = createFakeLambdaClient([]);
    const result = await findFunction(client, { override: 'explicit-name' });
    expect(result).toBe('explicit-name');
    expect(client.send).not.toHaveBeenCalled();
  });

  it('returns the unique match without prompting', async () => {
    const client = createFakeLambdaClient([
      {
        Functions: [{ FunctionName: 'unrelated-fn' }, { FunctionName: 'alfe-dev-MigrationFn-abc' }],
      },
    ]);
    const selectFn = vi.fn();
    const result = await findFunction(client, {
      selectFn: selectFn as unknown as Parameters<typeof findFunction>[1]['selectFn'],
    });
    expect(result).toBe('alfe-dev-MigrationFn-abc');
    expect(selectFn).not.toHaveBeenCalled();
  });

  it('prompts when multiple matches', async () => {
    const client = createFakeLambdaClient([
      {
        Functions: [
          { FunctionName: 'alfe-dev-MigrationFn' },
          { FunctionName: 'alfe-prod-MigrationFn' },
        ],
      },
    ]);
    const selectFn = vi.fn().mockResolvedValue('alfe-prod-MigrationFn');
    const result = await findFunction(client, {
      selectFn: selectFn as unknown as Parameters<typeof findFunction>[1]['selectFn'],
    });
    expect(result).toBe('alfe-prod-MigrationFn');
    expect(selectFn).toHaveBeenCalledTimes(1);
  });

  it('paginates ListFunctions across NextMarker', async () => {
    const client = createFakeLambdaClient([
      { Functions: [{ FunctionName: 'unrelated' }], NextMarker: 'page-2' },
      { Functions: [{ FunctionName: 'something-MigrationFn' }] },
    ]);
    const result = await findFunction(client);
    expect(result).toBe('something-MigrationFn');
    expect(client.send).toHaveBeenCalledTimes(2);
  });

  it('throws a friendly error when zero matches', async () => {
    const client = createFakeLambdaClient([{ Functions: [{ FunctionName: 'unrelated' }] }]);
    await expect(findFunction(client)).rejects.toThrow(/No Lambda functions matching/);
  });
});

describe('findTable', () => {
  it('returns override directly without listing', async () => {
    const client = createFakeDdbClient([]);
    const result = await findTable(client, { override: 'explicit-table' });
    expect(result).toBe('explicit-table');
    expect(client.send).not.toHaveBeenCalled();
  });

  it('returns the unique match without prompting', async () => {
    const client = createFakeDdbClient([
      { TableNames: ['unrelated-table', 'alfe-dev-MigrationsTable-x'] },
    ]);
    const result = await findTable(client);
    expect(result).toBe('alfe-dev-MigrationsTable-x');
  });

  it('paginates ListTables across LastEvaluatedTableName', async () => {
    const client = createFakeDdbClient([
      { TableNames: ['unrelated'], LastEvaluatedTableName: 'unrelated' },
      { TableNames: ['something-MigrationsTable'] },
    ]);
    const result = await findTable(client);
    expect(result).toBe('something-MigrationsTable');
    expect(client.send).toHaveBeenCalledTimes(2);
  });

  it('prompts when multiple matches', async () => {
    const client = createFakeDdbClient([
      { TableNames: ['alfe-dev-MigrationsTable', 'alfe-prod-MigrationsTable'] },
    ]);
    const selectFn = vi.fn().mockResolvedValue('alfe-prod-MigrationsTable');
    const result = await findTable(client, {
      selectFn: selectFn as unknown as Parameters<typeof findTable>[1]['selectFn'],
    });
    expect(result).toBe('alfe-prod-MigrationsTable');
  });

  it('throws when zero matches', async () => {
    const client = createFakeDdbClient([{ TableNames: ['unrelated'] }]);
    await expect(findTable(client)).rejects.toThrow(/No DynamoDB tables matching/);
  });
});
