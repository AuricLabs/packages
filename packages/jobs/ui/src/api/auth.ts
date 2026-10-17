export interface JobsBrowserConfig {
  apiUrl: string;
  auth: {
    parentOrigin: string;
    signInUrl: string;
  };
}

declare global {
  var __JOBS_CONFIG__: JobsBrowserConfig | undefined;
  var __JOBS_API_URL__: string | undefined;
}

export function getJobsBrowserConfig(): JobsBrowserConfig | undefined {
  return globalThis.__JOBS_CONFIG__;
}

/** Request a fresh token from the known operator-app iframe parent. */
export async function requestParentToken(config: JobsBrowserConfig): Promise<string | null> {
  if (window.parent === window) return null;

  const nonce = crypto.randomUUID();
  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      resolve(token);
    };
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== config.auth.parentOrigin ||
        event.source !== window.parent ||
        !isTokenResponse(event.data, nonce)
      ) return;
      finish(event.data.token);
    };
    const timeout = setTimeout(() => finish(null), 10_000);
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: 'auriclabs.jobs.token.request', nonce }, config.auth.parentOrigin);
  });
}

function isTokenResponse(value: unknown, nonce: string): value is { token: string | null } {
  if (!value || typeof value !== 'object') return false;
  const response = value as Record<string, unknown>;
  return response.type === 'auriclabs.jobs.token.response' &&
    response.nonce === nonce &&
    (response.token === null || (typeof response.token === 'string' && response.token.length > 0));
}
