import type {
  CancelResponse,
  JobDetailResponse,
  JobStatus,
  JobsSummary,
  ListJobsResponse,
  RetryResponse,
} from './types';

const API_URL =
  import.meta.env.VITE_API_URL ??
  (globalThis as Record<string, unknown>).__JOBS_API_URL__ ??
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

export interface ListJobsParams {
  status?: JobStatus;
  cursor?: string;
  limit?: number;
}

export const api = {
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
