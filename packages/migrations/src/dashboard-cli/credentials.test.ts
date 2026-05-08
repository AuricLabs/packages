import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { ensureCredentialsValid, looksLikeExpiredSsoError, runSsoLogin } from './credentials';

import type { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@aws-sdk/types';

describe('looksLikeExpiredSsoError', () => {
  it('matches ExpiredTokenException by name alone', () => {
    expect(looksLikeExpiredSsoError({ name: 'ExpiredTokenException', message: 'whatever' })).toBe(
      true,
    );
  });

  it('matches SSOTokenInvalidException by name alone', () => {
    expect(looksLikeExpiredSsoError({ name: 'SSOTokenInvalidException' })).toBe(true);
  });

  it('matches CredentialsProviderError when message hints at SSO expiry', () => {
    expect(
      looksLikeExpiredSsoError({
        name: 'CredentialsProviderError',
        message: 'The SSO session associated with this profile has expired',
      }),
    ).toBe(true);
  });

  it('does NOT match unrelated CredentialsProviderError', () => {
    expect(
      looksLikeExpiredSsoError({
        name: 'CredentialsProviderError',
        message: 'Profile foo not found',
      }),
    ).toBe(false);
  });

  it('does NOT match null / non-error values', () => {
    expect(looksLikeExpiredSsoError(null)).toBe(false);
    expect(looksLikeExpiredSsoError('expired')).toBe(false);
  });

  it('matches a plain Error whose message hints at expiry (pattern fallback)', () => {
    expect(looksLikeExpiredSsoError(new Error('Token has expired'))).toBe(true);
    expect(looksLikeExpiredSsoError(new Error('something unrelated'))).toBe(false);
  });
});

describe('runSsoLogin', () => {
  function createMockChild(): EventEmitter & { stdout: null; stderr: null; stdin: null } {
    const child = Object.assign(new EventEmitter(), {
      stdout: null,
      stderr: null,
      stdin: null,
    });
    return child;
  }

  it('resolves on exit code 0', async () => {
    const child = createMockChild();
    const spawnFn = vi.fn().mockReturnValue(child);
    const promise = runSsoLogin({
      profile: 'alfe-dev',
      spawnFn: spawnFn as unknown as typeof import('node:child_process').spawn,
    });
    setTimeout(() => child.emit('exit', 0), 0);
    await expect(promise).resolves.toBeUndefined();
    expect(spawnFn).toHaveBeenCalledWith(
      'aws',
      ['sso', 'login', '--profile', 'alfe-dev'],
      expect.objectContaining({ stdio: 'inherit' }),
    );
  });

  it('rejects on non-zero exit', async () => {
    const child = createMockChild();
    const spawnFn = vi.fn().mockReturnValue(child);
    const promise = runSsoLogin({
      profile: 'alfe-dev',
      spawnFn: spawnFn as unknown as typeof import('node:child_process').spawn,
    });
    setTimeout(() => child.emit('exit', 1), 0);
    await expect(promise).rejects.toThrow(/exited with code 1/);
  });

  it('rejects with a friendly hint when spawn errors out', async () => {
    const child = createMockChild();
    const spawnFn = vi.fn().mockReturnValue(child);
    const promise = runSsoLogin({
      profile: 'alfe-dev',
      spawnFn: spawnFn as unknown as typeof import('node:child_process').spawn,
    });
    setTimeout(() => child.emit('error', new Error('ENOENT')), 0);
    await expect(promise).rejects.toThrow(/AWS CLI installed and on \$PATH/);
  });
});

describe('ensureCredentialsValid', () => {
  const validIdentity: AwsCredentialIdentity = {
    accessKeyId: 'AKIA',
    secretAccessKey: 'secret',
  };

  it('returns identity on first try', async () => {
    const provider = vi.fn().mockResolvedValue(validIdentity);
    const result = await ensureCredentialsValid({
      provider: provider as unknown as AwsCredentialIdentityProvider,
      profile: 'alfe-dev',
    });
    expect(result).toBe(validIdentity);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('rethrows non-SSO errors unchanged', async () => {
    const err = new Error('Profile not found');
    err.name = 'NotASsoError';
    const provider = vi.fn().mockRejectedValue(err);
    await expect(
      ensureCredentialsValid({
        provider: provider as unknown as AwsCredentialIdentityProvider,
        profile: 'alfe-dev',
      }),
    ).rejects.toThrow(/Profile not found/);
  });

  it('on expired-SSO + user confirms, runs aws sso login and retries once', async () => {
    const expired = Object.assign(new Error('Token expired'), { name: 'ExpiredTokenException' });
    const provider = vi.fn().mockRejectedValueOnce(expired).mockResolvedValueOnce(validIdentity);

    const confirmFn = vi.fn().mockResolvedValue(true);
    const child = Object.assign(new EventEmitter(), { stdout: null, stderr: null, stdin: null });
    const spawnFn = vi.fn().mockImplementation(() => {
      setTimeout(() => child.emit('exit', 0), 0);
      return child;
    });

    const result = await ensureCredentialsValid({
      provider: provider as unknown as AwsCredentialIdentityProvider,
      profile: 'alfe-prod',
      confirmFn: confirmFn as unknown as Parameters<typeof ensureCredentialsValid>[0]['confirmFn'],
      spawnFn: spawnFn as unknown as typeof import('node:child_process').spawn,
    });

    expect(result).toBe(validIdentity);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(spawnFn).toHaveBeenCalledWith(
      'aws',
      ['sso', 'login', '--profile', 'alfe-prod'],
      expect.anything(),
    );
  });

  it('on expired-SSO + user declines, aborts without retry', async () => {
    const expired = Object.assign(new Error('Token expired'), { name: 'ExpiredTokenException' });
    const provider = vi.fn().mockRejectedValue(expired);
    const confirmFn = vi.fn().mockResolvedValue(false);
    const spawnFn = vi.fn();

    await expect(
      ensureCredentialsValid({
        provider: provider as unknown as AwsCredentialIdentityProvider,
        profile: 'alfe-prod',
        confirmFn: confirmFn as unknown as Parameters<
          typeof ensureCredentialsValid
        >[0]['confirmFn'],
        spawnFn: spawnFn as unknown as typeof import('node:child_process').spawn,
      }),
    ).rejects.toThrow(/Aborted/);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(spawnFn).not.toHaveBeenCalled();
  });
});
