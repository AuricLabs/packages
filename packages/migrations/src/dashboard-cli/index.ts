import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Command } from 'commander';

import { DynamoDBMigrationStorage } from '../dynamodb';

import { ensureCredentialsValid, loadCredentials } from './credentials';
import { findFunction, findTable } from './discovery';
import { pickProfile } from './profile';
import { startDashboardServer } from './server';

import type { AwsCredentialIdentityProvider } from '@aws-sdk/types';

export interface RunDashboardCliOptions {
  /** Override the package root resolver — for tests. Defaults to resolving the published package. */
  packageRoot?: string;
  /** Override `import('open')` — for tests. */
  openFn?: (target: string) => Promise<unknown>;
  /** Receive the resolved server handle — for tests. */
  onReady?: (info: {
    url: string;
    profile: string;
    functionName: string;
    tableName: string;
  }) => void;
  /** When true, do not register SIGINT handler (lets tests resolve immediately after onReady). */
  noWait?: boolean;
}

export {
  ensureCredentialsValid,
  loadCredentials,
  looksLikeExpiredSsoError,
  runSsoLogin,
} from './credentials';
export { findFunction, findTable } from './discovery';
export {
  loadProfiles,
  parseIni,
  pickProfile,
  profilesFromConfig,
  type AwsProfile,
} from './profile';
export { startDashboardServer, type DashboardServer } from './server';

interface ParsedArgs {
  profile?: string;
  region?: string;
  functionName?: string;
  tableName?: string;
  port?: number;
  noOpen: boolean;
  nonInteractive: boolean;
}

/** Shape of the raw object returned by `commander`'s `program.opts()`. */
interface RawCliOpts {
  profile?: string;
  region?: string;
  functionName?: string;
  tableName?: string;
  port?: number;
  noOpen?: boolean;
  nonInteractive?: boolean;
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('auric-migrate-dashboard')
    .description(
      'Run the migrations dashboard locally against any AWS account selected by SSO profile. ' +
        'Direct-invokes the deployed `MigrationFn` Lambda and reads `MigrationsTable` via your IAM identity.',
    )
    .option('-p, --profile <name>', 'AWS profile to use (default: AWS_PROFILE env or interactive)')
    .option('-r, --region <region>', 'AWS region (default: profile or AWS_REGION)')
    .option('--function-name <name>', 'Skip Lambda discovery — use this function name')
    .option('--table-name <name>', 'Skip DynamoDB discovery — use this table name')
    .option('--port <number>', 'Local server port (default: 3100)', (v) => parseInt(v, 10))
    .option('--no-open', 'Do not auto-open the browser')
    .option('--non-interactive', 'Fail on missing creds rather than prompting');
  return program;
}

/**
 * Entrypoint used by the bin shim. Parses argv, picks a profile, resolves
 * credentials (auto-running `aws sso login` on expiry), discovers the
 * deployed Lambda + table, starts a local server bound to 127.0.0.1, and
 * opens the user's browser at the dashboard URL.
 *
 * Returns when the server is closed (typically via SIGINT). Intended to run
 * to process exit; do NOT call this concurrently in the same process.
 */
export async function runDashboardCli(
  argv: string[],
  options: RunDashboardCliOptions = {},
): Promise<void> {
  const program = buildProgram();
  program.parse(argv);
  const opts = program.opts<RawCliOpts>();
  const args: ParsedArgs = {
    profile: opts.profile,
    region: opts.region,
    functionName: opts.functionName,
    tableName: opts.tableName,
    port: typeof opts.port === 'number' && Number.isFinite(opts.port) ? opts.port : undefined,
    noOpen: opts.noOpen === true,
    nonInteractive: opts.nonInteractive === true,
  };

  const profile = await pickProfile({
    profileFlag: args.profile,
    nonInteractive: args.nonInteractive,
  });
  process.stderr.write(
    `> Using AWS profile: ${profile.name}${profile.region ? ` (${profile.region})` : ''}\n`,
  );

  const region = args.region ?? profile.region ?? process.env.AWS_REGION ?? 'us-east-1';

  // Propagate the chosen profile + region into the env so the package's
  // internal `invokeLambdaSync/Async` (which constructs its own Lambda
  // client via the default credential chain) resolves to the same identity
  // we're using for discovery + DynamoDB. This mirrors what the AWS CLI
  // itself does when you pass `--profile`.
  process.env.AWS_PROFILE = profile.name;
  process.env.AWS_REGION = region;

  const provider: AwsCredentialIdentityProvider = loadCredentials({ profile: profile.name });
  await ensureCredentialsValid({ provider, profile: profile.name });

  const lambda = new LambdaClient({ region, credentials: provider });
  const ddb = new DynamoDBClient({ region, credentials: provider });
  const ddbDoc = DynamoDBDocumentClient.from(ddb);

  process.stderr.write('> Discovering deployed migrations resources...\n');
  const [functionName, tableName] = await Promise.all([
    findFunction(lambda, { override: args.functionName }),
    findTable(ddb, { override: args.tableName }),
  ]);
  process.stderr.write(`> Lambda: ${functionName}\n> Table:  ${tableName}\n`);

  const storage = new DynamoDBMigrationStorage({ tableName, client: ddbDoc });

  const uiAssetsDir = resolveUiAssetsDir(options.packageRoot);
  const server = await startDashboardServer({
    storage,
    migrationFunctionName: functionName,
    uiAssetsDir,
    port: args.port,
  });
  process.stderr.write(`> Dashboard ready: ${server.url}\n`);

  options.onReady?.({
    url: server.url,
    profile: profile.name,
    functionName,
    tableName,
  });

  if (!args.noOpen) {
    const openFn = options.openFn ?? (async (t: string) => (await import('open')).default(t));
    try {
      await openFn(server.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `(Could not auto-open browser: ${msg}; navigate manually to ${server.url})\n`,
      );
    }
  }

  if (options.noWait) {
    await server.close();
    return;
  }

  await new Promise<void>((resolveSig) => {
    const stop = () => {
      process.stderr.write('\n> Shutting down...\n');
      void server.close().finally(resolveSig);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}

/**
 * Resolve the absolute path to this package's `ui/dist/` directory. Works
 * whether the bin is run via `npx` (installed under
 * `node_modules/@auriclabs/migrations`) or via a local `pnpm link` / `yalc`
 * checkout.
 */
function resolveUiAssetsDir(override?: string): string {
  if (override) return join(override, 'ui', 'dist');
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve('@auriclabs/migrations/package.json');
  const pkgRoot = dirname(pkgJsonPath);
  return join(pkgRoot, 'ui', 'dist');
}
