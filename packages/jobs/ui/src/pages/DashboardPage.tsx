import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useJobsSummary, useRecentJobs } from '../hooks/queries';
import type { Job } from '../api/types';
import { JobTable } from '../components/JobTable';
import { RetryDialog } from '../components/RetryDialog';
import { CancelDialog } from '../components/CancelDialog';

interface SummaryCardProps {
  label: string;
  count: number;
  colorClass?: string;
}

function SummaryCard({ label, count, colorClass = 'text-zinc-100' }: SummaryCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`text-3xl font-semibold ${colorClass}`}>{count}</p>
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="h-3 w-20 bg-zinc-800 rounded animate-pulse mb-2" />
      <div className="h-8 w-14 bg-zinc-800 rounded animate-pulse" />
    </div>
  );
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [retryJob, setRetryJob] = useState<Job | null>(null);
  const [cancelJob, setCancelJob] = useState<Job | null>(null);

  // Poll while there is active (pending or running) work.
  const [polling, setPolling] = useState(false);
  const { data: summary, isPending: summaryPending, error: summaryError } = useJobsSummary(polling);
  const hasActive = (summary?.running ?? 0) > 0 || (summary?.pending ?? 0) > 0;

  useEffect(() => {
    setPolling(hasActive);
  }, [hasActive]);

  const { data: recent, isPending: recentPending, error: recentError } = useRecentJobs(20, polling);

  const error = summaryError || recentError;
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4">
        {error.message}
      </div>
    );
  }

  const pending = summary?.pending ?? 0;
  const running = summary?.running ?? 0;
  const completed = summary?.completed ?? 0;
  const failed = summary?.failed ?? 0;
  const cancelled = summary?.cancelled ?? 0;
  const total = pending + running + completed + failed + cancelled;

  const handleActionComplete = () => {
    void queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-100 mb-6">Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {summaryPending ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <SummaryCardSkeleton key={i} />
            ))}
          </>
        ) : (
          <>
            <SummaryCard label="Pending" count={pending} colorClass="text-amber-400" />
            <SummaryCard label="Running" count={running} colorClass="text-blue-400" />
            <SummaryCard label="Completed" count={completed} colorClass="text-green-400" />
            <SummaryCard label="Failed" count={failed} colorClass="text-red-400" />
            <SummaryCard label="Cancelled" count={cancelled} colorClass="text-zinc-400" />
            <SummaryCard label="Total" count={total} colorClass="text-zinc-100" />
          </>
        )}
      </div>

      <h2 className="text-lg font-medium text-zinc-200 mt-8 mb-3">Recent Jobs</h2>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
        <JobTable
          rows={recent?.jobs ?? []}
          loading={recentPending}
          onRetry={setRetryJob}
          onCancel={setCancelJob}
        />
      </div>

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
