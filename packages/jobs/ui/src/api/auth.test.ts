import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestParentToken, type JobsBrowserConfig } from './auth';

const config: JobsBrowserConfig = {
  apiUrl: 'https://api.example.test',
  auth: {
    parentOrigin: 'https://admin.example.test',
    signInUrl: 'https://admin.example.test/jobs',
  },
};

afterEach(() => vi.unstubAllGlobals());

describe('requestParentToken', () => {
  it('refuses direct page visits', async () => {
    const sameWindow = {} as Window;
    sameWindow.parent = sameWindow;
    vi.stubGlobal('window', sameWindow);

    await expect(requestParentToken(config)).resolves.toBeNull();
  });

  it('accepts only a response from the exact parent, nonce and origin', async () => {
    const parent = { postMessage: vi.fn() } as unknown as Window;
    let onMessage: ((event: MessageEvent) => void) | undefined;
    const child = {
      parent,
      addEventListener: vi.fn((_type: string, listener: (event: MessageEvent) => void) => {
        onMessage = listener;
      }),
      removeEventListener: vi.fn(),
    } as unknown as Window;
    vi.stubGlobal('window', child);

    const result = requestParentToken(config);
    const request = vi.mocked(parent.postMessage).mock.calls[0][0] as { nonce: string };
    expect(vi.mocked(parent.postMessage)).toHaveBeenCalledWith(
      { type: 'auriclabs.jobs.token.request', nonce: request.nonce },
      config.auth.parentOrigin,
    );

    const validData = {
      type: 'auriclabs.jobs.token.response',
      nonce: request.nonce,
      token: 'short-lived-token',
    };
    onMessage?.({ origin: 'https://evil.example.test', source: parent, data: validData } as MessageEvent);
    onMessage?.({ origin: config.auth.parentOrigin, source: {} as Window, data: validData } as MessageEvent);
    onMessage?.({ origin: config.auth.parentOrigin, source: parent, data: { ...validData, nonce: 'wrong' } } as MessageEvent);
    expect(child.removeEventListener).not.toHaveBeenCalled();

    onMessage?.({ origin: config.auth.parentOrigin, source: parent, data: validData } as MessageEvent);
    await expect(result).resolves.toBe('short-lived-token');
    expect(child.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });
});
