import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Command } from 'commander';

import { initJobs } from '../init';

import { ensureCredentialsValid, loadCredentials } from './credentials';
import { findTable } from './discovery';
import { pickProfile } from './profile';
import { startDashboardServer } from './server';

import type { AwsCredentialIdentityProvider } from '@aws-sdk/types';

export interface RunDashboardCliOptions {
  /** Override the package root resolver — for tests. Defaults to resolving the published package. */
  packageRoot?: string;
  /** Override `import('open')` — for tests. */
  openFn?: (target: string) => Promise<unknown>;
  /** Receive the resolved server handle — for tests. */
  onReady?: (info: { url: string; profile: string; tableName: string }) => void;
  /** When true, do not register SIGINT handler (lets tests resolve immediately after onReady). */
  noWait?: boolean;
}

export {
  ensureCredentialsValid,
  loadCredentials,
  looksLikeExpiredSsoError,
  runSsoLogin,
} from './credentials';
export { findTable } from './discovery';
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
  tableName?: string;
  port?: number;
  noOpen: boolean;
  nonInteractive: boolean;
}

/** Shape of the raw object returned by `commander`'s `program.opts()`. */
interface RawCliOpts {
  profile?: string;
  region?: string;
  tableName?: string;
  port?: number;
  /** commander maps `--no-open` to `open: false`, not `noOpen: true` */
  open?: boolean;
  nonInteractive?: boolean;
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('auric-jobs-dashboard')
    .description(
      'Run the jobs dashboard locally against any AWS account selected by SSO profile. ' +
        'Reads and writes the deployed job table (`JobTable`) directly via your IAM identity.',
    )
    .option('-p, --profile <name>', 'AWS profile to use (default: AWS_PROFILE env or interactive)')
    .option('-r, --region <region>', 'AWS region (default: profile or AWS_REGION)')
    .option('--table-name <name>', 'Skip DynamoDB discovery — use this table name')
    .option('--port <number>', 'Local server port (default: 3101)', (v) => parseInt(v, 10))
    .option('--no-open', 'Do not auto-open the browser')
    .option('--non-interactive', 'Fail on missing creds rather than prompting');
  return program;
}

/**
 * Entrypoint used by the bin shim. Parses argv, picks a profile, resolves
 * credentials (auto-running `aws sso login` on expiry), discovers the
 * deployed job table, starts a local server bound to 127.0.0.1, and opens
 * the user's browser at the dashboard URL.
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
    tableName: opts.tableName,
    port: typeof opts.port === 'number' && Number.isFinite(opts.port) ? opts.port : undefined,
    noOpen: opts.open === false,
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
  // internal clients (the job/job-attempt models construct their own
  // `DynamoDBClient` via the default credential chain) resolve to the same
  // identity we're using for discovery. This mirrors what the AWS CLI itself
  // does when you pass `--profile`.
  process.env.AWS_PROFILE = profile.name;
  process.env.AWS_REGION = region;

  const provider: AwsCredentialIdentityProvider = loadCredentials({ profile: profile.name });
  await ensureCredentialsValid({ provider, profile: profile.name });

  const ddb = new DynamoDBClient({ region, credentials: provider });

  process.stderr.write('> Discovering deployed job table...\n');
  const tableName = await findTable(ddb, { override: args.tableName });
  process.stderr.write(`> Table: ${tableName}\n`);

  // Retry/cancel are direct DynamoDB writes — the deployed stream handler
  // picks up new job-attempt rows and does the SQS enqueue, so no Lambda or
  // queue discovery is needed here.
  initJobs({ tableName });

  const uiAssetsDir = resolveUiAssetsDir(options.packageRoot);
  const server = await startDashboardServer({
    uiAssetsDir,
    port: args.port,
  });
  process.stderr.write(`> Dashboard ready: ${server.url}\n`);

  options.onReady?.({
    url: server.url,
    profile: profile.name,
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
 * `node_modules/@auriclabs/jobs`) or via a local `pnpm link` / `yalc`
 * checkout.
 */
function resolveUiAssetsDir(override?: string): string {
  if (override) return join(override, 'ui', 'dist');
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve('@auriclabs/jobs/package.json');
  const pkgRoot = dirname(pkgJsonPath);
  return join(pkgRoot, 'ui', 'dist');
}
