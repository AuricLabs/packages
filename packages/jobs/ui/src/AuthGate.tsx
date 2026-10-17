import { useEffect, useState } from 'react';

import { api } from './api/client';
import { getJobsBrowserConfig } from './api/auth';
import { App } from './App';

/** The deployed dashboard reveals no job data until its host confirms access. */
export function AuthGate() {
  const config = getJobsBrowserConfig();
  const [status, setStatus] = useState<'checking' | 'ready' | 'denied'>(
    config?.auth ? 'checking' : 'ready',
  );

  useEffect(() => {
    if (!config?.auth) return;
    if (window.parent === window) {
      setStatus('denied');
      return;
    }
    let active = true;
    const onDenied = () => setStatus('denied');
    window.addEventListener('auriclabs.jobs.authorization-denied', onDenied);
    void api.getSession().then(
      () => { if (active) setStatus('ready'); },
      () => { if (active) setStatus('denied'); },
    );
    return () => {
      active = false;
      window.removeEventListener('auriclabs.jobs.authorization-denied', onDenied);
    };
  }, [config]);

  if (status === 'ready') return <App />;
  if (status === 'checking') {
    return <main role="status" className="p-8 text-zinc-300">Checking operator access…</main>;
  }
  return (
    <main className="mx-auto max-w-lg p-8 text-zinc-200">
      <h1 className="mb-3 text-xl font-semibold">Administrator sign-in required</h1>
      <p className="mb-4 text-zinc-400">Open Jobs from the administrator console.</p>
      {config?.auth && <a className="underline" href={config.auth.signInUrl}>Open administrator console</a>}
    </main>
  );
}
