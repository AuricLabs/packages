import { spawn, type SpawnOptions } from 'node:child_process';

import { fromIni } from '@aws-sdk/credential-providers';
import { confirm } from '@inquirer/prompts';

import type { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@aws-sdk/types';

export interface LoadCredentialsOptions {
  profile: string;
  /** Override the underlying credential provider — for tests. */
  providerFactory?: (profile: string) => AwsCredentialIdentityProvider;
}

/**
 * Build a credential provider for a given AWS profile. Uses `fromIni` which
 * transparently follows `sso_session` → SSO token cache, `role_arn` → STS
 * AssumeRole, and `credential_process`-based custom providers. Returned
 * provider does NOT call AWS until invoked — the SSO token cache is consulted
 * lazily.
 */
export function loadCredentials(opts: LoadCredentialsOptions): AwsCredentialIdentityProvider {
  if (opts.providerFactory) return opts.providerFactory(opts.profile);
  return fromIni({ profile: opts.profile });
}

/**
 * SSO-related error names the AWS SDK / @aws-sdk/credential-providers throw
 * when a cached SSO token is expired or absent. We match by name AND message
 * substring because different AWS SDK versions surface the same condition
 * under different error classes.
 */
const SSO_EXPIRED_PATTERNS = [
  /sso session.*expired/i,
  /token.*expired/i,
  /the sso session associated with this profile has expired/i,
  /no cached sso session credentials/i,
  /failed to load sso credentials/i,
  /sso authorization.*expired/i,
];

const SSO_ERROR_NAMES = new Set([
  'ExpiredTokenException',
  'SSOTokenInvalidException',
  'CredentialsProviderError',
  'TokenProviderError',
]);

export function looksLikeExpiredSsoError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { name?: string; message?: string };
  if (e.name && SSO_ERROR_NAMES.has(e.name)) {
    const msg = e.message ?? '';
    if (SSO_EXPIRED_PATTERNS.some((p) => p.test(msg))) return true;
    // Some SDK versions throw a bare CredentialsProviderError with no
    // matching message; fall through to false there to avoid prompting on
    // unrelated provider failures (eg. profile-not-found).
    if (e.name === 'CredentialsProviderError' && !msg) return false;
    if (e.name === 'ExpiredTokenException' || e.name === 'SSOTokenInvalidException') return true;
  }
  // Fallback: pattern-match the message regardless of class.
  return SSO_EXPIRED_PATTERNS.some((p) => p.test(e.message ?? ''));
}

export interface RunSsoLoginOptions {
  profile: string;
  /** Override the spawn fn — for tests. */
  spawnFn?: typeof spawn;
}

/**
 * Spawn `aws sso login --profile <name>` with inherited stdio so the AWS
 * CLI's own browser-based flow renders to the user's terminal. Resolves on
 * exit code 0; rejects on non-zero or spawn failure.
 *
 * Requires the `aws` CLI to be on `$PATH`; document this in the package
 * README. We don't reimplement OIDC/SSO ourselves — that would duplicate
 * a substantial amount of AWS-CLI security-sensitive code.
 */
export function runSsoLogin(opts: RunSsoLoginOptions): Promise<void> {
  const spawnImpl = opts.spawnFn ?? spawn;
  return new Promise((resolve, reject) => {
    const spawnOptions: SpawnOptions = { stdio: 'inherit' };
    const child = spawnImpl('aws', ['sso', 'login', '--profile', opts.profile], spawnOptions);
    child.on('error', (err) => {
      reject(
        new Error(
          `Failed to launch "aws sso login": ${err.message}. Is the AWS CLI installed and on $PATH?`,
        ),
      );
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`"aws sso login --profile ${opts.profile}" exited with code ${code}`));
    });
  });
}

export interface EnsureCredentialsOptions {
  provider: AwsCredentialIdentityProvider;
  profile: string;
  /** Override the confirm prompt — for tests. */
  confirmFn?: typeof confirm;
  /** Override the spawn fn — for tests. */
  spawnFn?: typeof spawn;
}

/**
 * Invoke the credential provider once. On expired-SSO errors, prompt the user
 * to confirm running `aws sso login --profile <name>` and retry exactly once.
 * Any other error is re-thrown unchanged so the caller can surface a useful
 * message.
 */
export async function ensureCredentialsValid(
  opts: EnsureCredentialsOptions,
): Promise<AwsCredentialIdentity> {
  const ask = opts.confirmFn ?? confirm;
  try {
    return await opts.provider();
  } catch (err) {
    if (!looksLikeExpiredSsoError(err)) throw err;

    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\nSSO session for profile "${opts.profile}" is not valid: ${message}\n`);

    const proceed = await ask({
      message: `Run \`aws sso login --profile ${opts.profile}\` now?`,
      default: true,
    });
    if (!proceed) {
      throw new Error(`Aborted: please run \`aws sso login --profile ${opts.profile}\` and retry.`);
    }

    await runSsoLogin({ profile: opts.profile, spawnFn: opts.spawnFn });
    // Retry exactly once. If it still fails, surface the underlying error.
    return await opts.provider();
  }
}
