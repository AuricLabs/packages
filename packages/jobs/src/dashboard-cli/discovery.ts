import { ListTablesCommand, type DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { select } from '@inquirer/prompts';

const DEFAULT_TABLE_FILTER = 'JobTable';

export interface FindTableOptions {
  /** Pre-resolved table name. When set, skips ListTables entirely. */
  override?: string;
  /** Substring filter (default `'JobTable'`). Case-sensitive. */
  filter?: string;
  /** Override the picker — for tests. */
  selectFn?: typeof select;
}

/**
 * Find the deployed job DynamoDB table name. Lists every table in the
 * account/region (paginated), filters by name-includes, and either returns
 * the unique match or prompts the user to disambiguate.
 *
 * Throws with a friendly message when zero matches.
 */
export async function findTable(
  client: DynamoDBClient,
  opts: FindTableOptions = {},
): Promise<string> {
  if (opts.override) return opts.override;
  const ask = opts.selectFn ?? select;
  const filter = opts.filter ?? DEFAULT_TABLE_FILTER;

  const matches: string[] = [];
  let exclusiveStartTableName: string | undefined;
  do {
    const res = await client.send(
      new ListTablesCommand({ ExclusiveStartTableName: exclusiveStartTableName }),
    );
    for (const name of res.TableNames ?? []) {
      if (name.includes(filter)) matches.push(name);
    }
    exclusiveStartTableName = res.LastEvaluatedTableName;
  } while (exclusiveStartTableName);

  if (matches.length === 0) {
    throw new Error(
      `No DynamoDB tables matching "${filter}" found in this account/region. ` +
        `Pass --table-name <name> if the deployed table uses a different convention.`,
    );
  }
  if (matches.length === 1) return matches[0];

  matches.sort();
  return ask({
    message: `Multiple tables match "${filter}". Pick one:`,
    choices: matches.map((name) => ({ name, value: name })),
  });
}
