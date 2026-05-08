import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { select } from '@inquirer/prompts';

export interface AwsProfile {
  /** Profile name as it appears in `aws --profile <name>` (without the `profile ` prefix). */
  name: string;
  /** True when the profile uses an `sso_session` reference or legacy `sso_*` keys. */
  isSso: boolean;
  /** Region declared on the profile (used as the SDK default if --region not passed). */
  region?: string;
  /** Account id for SSO profiles (informational only). */
  ssoAccountId?: string;
  /** SSO session name from `sso_session = ...` (modern SSO config). */
  ssoSession?: string;
}

/**
 * Parse an AWS shared-config-style INI file into a flat map of section → key/value.
 * Handles `[profile name]` and `[default]` headers; trims comments and whitespace.
 */
export function parseIni(text: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {};
  let current: Record<string, string> | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[#;].*$/, '').trim();
    if (line === '') continue;

    const header = /^\[(.+?)\]$/.exec(line);
    if (header) {
      const name = header[1].trim();
      current = sections[name] ?? {};
      sections[name] = current;
      continue;
    }

    if (!current) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key) current[key] = value;
  }

  return sections;
}

/**
 * Parse `~/.aws/config` into normalised `AwsProfile` entries.
 *
 * Section header conventions:
 * - `[default]` → profile name `default`
 * - `[profile foo]` → profile name `foo`
 * - `[sso-session bar]` → ignored as a profile (only referenced via `sso_session = bar`)
 */
export function profilesFromConfig(text: string): AwsProfile[] {
  const sections = parseIni(text);
  const profiles: AwsProfile[] = [];

  for (const [section, kv] of Object.entries(sections)) {
    let name: string | null = null;
    if (section === 'default') name = 'default';
    else if (section.startsWith('profile ')) name = section.slice('profile '.length).trim();
    if (!name) continue;

    profiles.push({
      name,
      isSso: 'sso_session' in kv || 'sso_start_url' in kv || 'sso_account_id' in kv,
      region: kv.region,
      ssoAccountId: kv.sso_account_id,
      ssoSession: kv.sso_session,
    });
  }

  return profiles;
}

/**
 * Read profiles from the standard AWS config locations (`~/.aws/config` and
 * `~/.aws/credentials`). Honours `AWS_CONFIG_FILE` / `AWS_SHARED_CREDENTIALS_FILE`
 * env overrides — same env vars the AWS SDK respects.
 *
 * Profiles defined only in `~/.aws/credentials` (no SSO) still surface here as
 * non-SSO entries so the picker can list them.
 */
export function loadProfiles(): AwsProfile[] {
  const configPath = process.env.AWS_CONFIG_FILE ?? join(homedir(), '.aws', 'config');
  const credPath =
    process.env.AWS_SHARED_CREDENTIALS_FILE ?? join(homedir(), '.aws', 'credentials');

  const profiles = new Map<string, AwsProfile>();

  try {
    const configText = readFileSync(configPath, 'utf8');
    for (const profile of profilesFromConfig(configText)) {
      profiles.set(profile.name, profile);
    }
  } catch (err) {
    if (!isFileNotFoundError(err)) throw err;
  }

  try {
    const credText = readFileSync(credPath, 'utf8');
    const sections = parseIni(credText);
    for (const section of Object.keys(sections)) {
      // `~/.aws/credentials` uses bare `[name]` (no `profile ` prefix).
      if (!profiles.has(section)) {
        profiles.set(section, {
          name: section,
          isSso: false,
          region: sections[section].region,
        });
      }
    }
  } catch (err) {
    if (!isFileNotFoundError(err)) throw err;
  }

  return [...profiles.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function isFileNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  );
}

export interface PickProfileOptions {
  /** Explicit profile name (overrides env + interactive). */
  profileFlag?: string;
  /** When set, skip interactive selection and fail if `profileFlag` / `AWS_PROFILE` is missing. */
  nonInteractive?: boolean;
  /** Override the profile loader — for tests. */
  loadProfilesFn?: () => AwsProfile[];
  /** Override the picker prompt — for tests. */
  selectFn?: typeof select;
}

/**
 * Resolve which AWS profile to use for this run. Order of precedence:
 * 1. `--profile <name>` flag (validated against discovered profiles).
 * 2. `AWS_PROFILE` env var (used as the default selection when interactive).
 * 3. Interactive picker showing all discovered profiles, default highlighted.
 *
 * Throws with a friendly error message when no profiles are discovered or
 * an explicit name doesn't match any discovered profile.
 */
export async function pickProfile(opts: PickProfileOptions = {}): Promise<AwsProfile> {
  const loader = opts.loadProfilesFn ?? loadProfiles;
  const ask = opts.selectFn ?? select;

  const profiles = loader();
  if (profiles.length === 0) {
    throw new Error(
      'No AWS profiles found in ~/.aws/config or ~/.aws/credentials. ' +
        'Configure one with `aws configure sso` or `aws configure`.',
    );
  }

  if (opts.profileFlag) {
    const match = profiles.find((p) => p.name === opts.profileFlag);
    if (!match) {
      throw new Error(
        `Profile "${opts.profileFlag}" not found. Available: ${profiles.map((p) => p.name).join(', ')}`,
      );
    }
    return match;
  }

  const envProfile = process.env.AWS_PROFILE;
  if (opts.nonInteractive) {
    if (!envProfile) {
      throw new Error(
        'No --profile flag and AWS_PROFILE is unset; interactive selection is disabled.',
      );
    }
    const match = profiles.find((p) => p.name === envProfile);
    if (!match) {
      throw new Error(`AWS_PROFILE=${envProfile} not found in config files.`);
    }
    return match;
  }

  const defaultName =
    envProfile && profiles.some((p) => p.name === envProfile) ? envProfile : profiles[0].name;

  const chosenName = await ask({
    message: 'Select an AWS profile',
    default: defaultName,
    choices: profiles.map((p) => ({
      name: p.isSso ? `${p.name}  (SSO${p.region ? `, ${p.region}` : ''})` : p.name,
      value: p.name,
    })),
  });

  // The picker only returns one of the listed names, so this find always
  // resolves; we still throw rather than non-null-assert for clarity.
  const chosen = profiles.find((p) => p.name === chosenName);
  if (!chosen) {
    throw new Error(`Internal error: picker returned unknown profile "${chosenName}"`);
  }
  return chosen;
}
