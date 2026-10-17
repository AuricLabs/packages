import type {
  CancelResponse,
  JobDetailResponse,
  JobStatus,
  JobsSummary,
  ListJobsResponse,
  RetryResponse,
} from './types';
import { getJobsBrowserConfig, requestParentToken } from './auth';

const API_URL =
  getJobsBrowserConfig()?.apiUrl ??
  import.meta.env.VITE_API_URL ??
  globalThis.__JOBS_API_URL__ ??
  '';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const config = getJobsBrowserConfig();
  if (config?.auth) {
    const token = await requestParentToken(config);
    if (!token) throw new Error('Administrator sign-in required');
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'omit' });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      window.dispatchEvent(new Event('auriclabs.jobs.authorization-denied'));
    }
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

export interface ListJobsParams {
  status?: JobStatus;
  cursor?: string;
  limit?: number;
}

export const api = {
  getSession: () => fetchJson<{ authenticated: true }>('/api/session'),
  getJobs: (params: ListJobsParams = {}) => {
    const search = new URLSearchParams();
    if (params.status) search.set('status', params.status);
    if (params.cursor) search.set('cursor', params.cursor);
    if (params.limit != null) search.set('limit', String(params.limit));
    const query = search.toString();
    return fetchJson<ListJobsResponse>(`/api/jobs${query ? `?${query}` : ''}`);
  },

  getJobsSummary: () => fetchJson<JobsSummary>('/api/jobs/summary'),

  getJobById: (id: string) =>
    fetchJson<JobDetailResponse>(`/api/jobs/${encodeURIComponent(id)}`),

  retryJob: (id: string, scheduledAt?: string) =>
    fetchJson<RetryResponse>(`/api/jobs/${encodeURIComponent(id)}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scheduledAt ? { scheduledAt } : {}),
    }),

  cancelJob: (id: string) =>
    fetchJson<CancelResponse>(`/api/jobs/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }),
};
