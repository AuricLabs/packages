import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

const POLL_INTERVAL = 3_000;

export function useMigrationsSummary() {
  return useQuery({
    queryKey: ['migrations', 'summary'],
    queryFn: api.getMigrationsSummary,
  });
}

export function useMigrations(polling = false) {
  return useQuery({
    queryKey: ['migrations'],
    queryFn: api.getMigrations,
    refetchInterval: polling ? POLL_INTERVAL : false,
  });
}

export function useMigrationById(id: string | undefined) {
  return useQuery({
    queryKey: ['migrations', id],
    queryFn: () => api.getMigrationById(id!),
    enabled: !!id,
  });
}

export function useExecutions(polling = false) {
  return useQuery({
    queryKey: ['executions'],
    queryFn: api.getExecutions,
    refetchInterval: polling ? POLL_INTERVAL : false,
  });
}

export function useExecutionById(executionId: string) {
  return useQuery({
    queryKey: ['executions', executionId],
    queryFn: () => api.getExecutionById(executionId),
  });
}

export function useMigrationStatus(polling = false) {
  return useQuery({
    queryKey: ['migrations', 'status'],
    queryFn: api.getStatus,
    refetchInterval: polling ? POLL_INTERVAL : false,
  });
}
