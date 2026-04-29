import type {
  MigrationRecord,
  MigrationSummary,
  ExecutionBatch,
  MigrateResponse,
  RollbackResponse,
  StatusResponse,
} from './types';

const API_URL =
  import.meta.env.VITE_API_URL ??
  (globalThis as Record<string, unknown>).__MIGRATIONS_API_URL__ ??
  '';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    let message = `API error ${res.status}: ${body}`;
    try {
      const parsed = JSON.parse(body) as { message?: string; error?: string };
      message = parsed.message ?? parsed.error ?? message;
    } catch {
      // use raw body
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getMigrations: () => fetchJson<MigrationRecord[]>('/api/migrations'),

  getMigrationsSummary: () => fetchJson<MigrationSummary>('/api/migrations/summary'),

  getMigrationById: (id: string) =>
    fetchJson<MigrationRecord[]>(`/api/migrations/${encodeURIComponent(id)}`),

  getExecutions: () => fetchJson<ExecutionBatch[]>('/api/executions'),

  getExecutionById: (executionId: string) =>
    fetchJson<MigrationRecord[]>(`/api/executions/${encodeURIComponent(executionId)}`),

  getStatus: () => fetchJson<StatusResponse>('/api/status'),

  migrate: (target?: string) =>
    fetchJson<MigrateResponse>('/api/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    }),

  rollback: (target?: string) =>
    fetchJson<RollbackResponse>('/api/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    }),
};
