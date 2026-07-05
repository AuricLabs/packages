import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { JobStatus } from '../api/types';

const POLL_INTERVAL = 3_000;

export function useJobsSummary(polling = false) {
  return useQuery({
    queryKey: ['jobs', 'summary'],
    queryFn: api.getJobsSummary,
    refetchInterval: polling ? POLL_INTERVAL : false,
  });
}

export function useRecentJobs(limit = 20, polling = false) {
  return useQuery({
    queryKey: ['jobs', 'recent', limit],
    queryFn: () => api.getJobs({ limit }),
    refetchInterval: polling ? POLL_INTERVAL : false,
  });
}

/**
 * Jobs list for the Jobs page. Without a status filter the API returns a
 * merged newest-first list with no cursor paging, so this collapses to a
 * single page. With a status filter, cursor-based "load more" is available.
 */
export function useJobs(status: JobStatus | undefined, limit = 50) {
  return useInfiniteQuery({
    queryKey: ['jobs', 'list', status ?? 'all', limit],
    queryFn: ({ pageParam }) =>
      api.getJobs({ status, cursor: pageParam ?? undefined, limit }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.cursor,
  });
}

export function useJobById(id: string | undefined, polling = false) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => api.getJobById(id!),
    enabled: !!id,
    refetchInterval: polling ? POLL_INTERVAL : false,
  });
}
