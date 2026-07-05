import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useJobs } from '../hooks/queries';
import type { Job, JobStatus } from '../api/types';
import { JOB_STATUSES, getStatusDisplay } from '../api/types';
import { JobTable } from '../components/JobTable';
import { RetryDialog } from '../components/RetryDialog';
import { CancelDialog } from '../components/CancelDialog';

const STATUS_OPTIONS: (JobStatus | 'all')[] = ['all', ...JOB_STATUSES];

function getFilterLabel(status: JobStatus | 'all'): string {
  return status === 'all' ? 'All' : getStatusDisplay(status).label;
}

export function JobsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [retryJob, setRetryJob] = useState<Job | null>(null);
  const [cancelJob, setCancelJob] = useState<Job | null>(null);

  const status = statusFilter === 'all' ? undefined : statusFilter;
  const {
    data,
    isPending,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useJobs(status);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4">
        {error.message}
      </div>
    );
  }

  const jobs = data?.pages.flatMap((page) => page.jobs) ?? [];

  const handleActionComplete = () => {
    void queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Jobs</h1>
      </div>

      <div className="flex gap-1.5 mb-4">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            onClick={() => setStatusFilter(s)}
          >
            {getFilterLabel(s)}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
        <JobTable
          rows={jobs}
          loading={isPending}
          onRetry={setRetryJob}
          onCancel={setCancelJob}
        />
      </div>

      {hasNextPage && (
        <div className="flex justify-center mt-4">
          <button
            className="px-4 py-2 rounded-md text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      <RetryDialog
        job={retryJob}
        onClose={() => setRetryJob(null)}
        onComplete={handleActionComplete}
      />
      <CancelDialog
        job={cancelJob}
        onClose={() => setCancelJob(null)}
        onComplete={handleActionComplete}
      />
    </div>
  );
}
