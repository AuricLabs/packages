import { describe, expect, it, vi } from 'vitest';

import { parseIni, pickProfile, profilesFromConfig, type AwsProfile } from './profile';

describe('parseIni', () => {
  it('parses sections, key/value, comments, blank lines', () => {
    const result = parseIni(`
# top comment
[default]
region = us-east-1
output=json   ; trailing comment

[profile dev]
region = ap-southeast-2
sso_session = my-org
`);
    expect(result).toEqual({
      default: { region: 'us-east-1', output: 'json' },
      'profile dev': { region: 'ap-southeast-2', sso_session: 'my-org' },
    });
  });

  it('ignores key/value before any section header', () => {
    const result = parseIni('orphan=ignored\n[default]\nfoo=bar\n');
    expect(result).toEqual({ default: { foo: 'bar' } });
  });

  it('handles empty input', () => {
    expect(parseIni('')).toEqual({});
  });
});

describe('profilesFromConfig', () => {
  it('extracts default + profile sections; ignores sso-session blocks', () => {
    const profiles = profilesFromConfig(`
[default]
region = us-east-1

[profile alfe-dev]
region = ap-southeast-2
sso_session = alfe-org
sso_account_id = 111122223333

[profile classic]
region = us-west-2

[sso-session alfe-org]
sso_start_url = https://example.awsapps.com/start
`);
    expect(profiles).toHaveLength(3);
    expect(profiles.find((p) => p.name === 'default')).toMatchObject({
      name: 'default',
      isSso: false,
      region: 'us-east-1',
    });
    expect(profiles.find((p) => p.name === 'alfe-dev')).toMatchObject({
      name: 'alfe-dev',
      isSso: true,
      region: 'ap-southeast-2',
      ssoSession: 'alfe-org',
      ssoAccountId: '111122223333',
    });
    expect(profiles.find((p) => p.name === 'classic')).toMatchObject({
      name: 'classic',
      isSso: false,
      region: 'us-west-2',
    });
    // sso-session block is NOT a profile.
    expect(profiles.find((p) => p.name === 'alfe-org')).toBeUndefined();
  });

  it('flags legacy sso_start_url as SSO too', () => {
    const profiles = profilesFromConfig(
      '[profile legacy-sso]\nsso_start_url = https://x\nsso_account_id = 1\n',
    );
    expect(profiles[0].isSso).toBe(true);
  });
});

describe('pickProfile', () => {
  const fakeProfiles: AwsProfile[] = [
    { name: 'alfe-dev', isSso: true, region: 'ap-southeast-2' },
    { name: 'alfe-prod', isSso: true, region: 'ap-southeast-2' },
    { name: 'default', isSso: false },
  ];

  it('returns the matching profile when --profile flag is set', async () => {
    const result = await pickProfile({
      profileFlag: 'alfe-prod',
      loadProfilesFn: () => fakeProfiles,
      // selectFn shouldn't be called when flag matches.
      selectFn: vi.fn(),
    });
    expect(result.name).toBe('alfe-prod');
  });

  it('throws a useful error when --profile does not match', async () => {
    await expect(
      pickProfile({ profileFlag: 'missing', loadProfilesFn: () => fakeProfiles }),
    ).rejects.toThrow(/not found.*alfe-dev, alfe-prod, default/);
  });

  it('throws when no profiles are configured', async () => {
    await expect(pickProfile({ loadProfilesFn: () => [] })).rejects.toThrow(/No AWS profiles/);
  });

  it('uses AWS_PROFILE env as default selection in interactive mode', async () => {
    const original = process.env.AWS_PROFILE;
    process.env.AWS_PROFILE = 'alfe-dev';
    try {
      const selectFn = vi.fn().mockResolvedValue('alfe-dev');
      const result = await pickProfile({
        loadProfilesFn: () => fakeProfiles,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        selectFn: selectFn as unknown as Parameters<typeof pickProfile>[0]['selectFn'],
      });
      expect(selectFn).toHaveBeenCalledWith(expect.objectContaining({ default: 'alfe-dev' }));
      expect(result.name).toBe('alfe-dev');
    } finally {
      process.env.AWS_PROFILE = original;
    }
  });

  it('non-interactive + no AWS_PROFILE rejects', async () => {
    const original = process.env.AWS_PROFILE;
    delete process.env.AWS_PROFILE;
    try {
      await expect(
        pickProfile({
          nonInteractive: true,
          loadProfilesFn: () => fakeProfiles,
        }),
      ).rejects.toThrow(/AWS_PROFILE is unset/);
    } finally {
      if (original !== undefined) process.env.AWS_PROFILE = original;
    }
  });
});
