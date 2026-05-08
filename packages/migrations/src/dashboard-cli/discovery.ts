import { ListTablesCommand, type DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ListFunctionsCommand, type LambdaClient } from '@aws-sdk/client-lambda';
import { select } from '@inquirer/prompts';

const DEFAULT_FUNCTION_FILTER = 'MigrationFn';
const DEFAULT_TABLE_FILTER = 'MigrationsTable';

export interface FindFunctionOptions {
  /** Pre-resolved function name. When set, skips ListFunctions entirely. */
  override?: string;
  /** Substring filter (default `'MigrationFn'`). Case-sensitive. */
  filter?: string;
  /** Override the picker — for tests. */
  selectFn?: typeof select;
}

/**
 * Find the deployed migrations Lambda function name. Lists every function in
 * the account/region (paginated), filters by name-includes, and either
 * returns the unique match or prompts the user to disambiguate.
 *
 * Throws with a friendly message when zero matches.
 */
export async function findFunction(
  client: LambdaClient,
  opts: FindFunctionOptions = {},
): Promise<string> {
  if (opts.override) return opts.override;
  const ask = opts.selectFn ?? select;
  const filter = opts.filter ?? DEFAULT_FUNCTION_FILTER;

  const matches: string[] = [];
  let marker: string | undefined;
  do {
    const res = await client.send(new ListFunctionsCommand({ Marker: marker }));
    for (const fn of res.Functions ?? []) {
      if (fn.FunctionName?.includes(filter)) matches.push(fn.FunctionName);
    }
    marker = res.NextMarker;
  } while (marker);

  if (matches.length === 0) {
    throw new Error(
      `No Lambda functions matching "${filter}" found in this account/region. ` +
        `Pass --function-name <name> if the deployed name uses a different convention.`,
    );
  }
  if (matches.length === 1) return matches[0];

  matches.sort();
  return ask({
    message: `Multiple Lambdas match "${filter}". Pick one:`,
    choices: matches.map((name) => ({ name, value: name })),
  });
}

export interface FindTableOptions {
  /** Pre-resolved table name. When set, skips ListTables entirely. */
  override?: string;
  /** Substring filter (default `'MigrationsTable'`). Case-sensitive. */
  filter?: string;
  /** Override the picker — for tests. */
  selectFn?: typeof select;
}

/**
 * Find the deployed migrations DynamoDB table name. Same shape as
 * `findFunction`: list, filter, prompt-on-multiple.
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
