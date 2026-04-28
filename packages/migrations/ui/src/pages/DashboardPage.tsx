import { useMigrationStatus, useExecutions } from '../hooks/queries';
import { ExecutionTable } from '../components/ExecutionTable';

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
  const { data: executions, isPending: executionsPending, error: executionsError } = useExecutions();
  const hasRunning = executions?.some((e) => e.status === 'running') ?? false;

  const { data: status, isPending: statusPending, error: statusError } = useMigrationStatus(hasRunning);

  const error = statusError || executionsError;
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4">
        {error.message}
      </div>
    );
  }

  const pending = status?.pending.length ?? 0;
  const completed = status?.completed.length ?? 0;
  const failed = status?.failed.length ?? 0;
  const total = pending + completed + failed;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-100 mb-6">Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statusPending ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <SummaryCard label="Migrated" count={completed} colorClass="text-green-400" />
            <SummaryCard label="Pending" count={pending} colorClass="text-amber-400" />
            <SummaryCard label="Failed" count={failed} colorClass="text-red-400" />
            <SummaryCard label="Total" count={total} colorClass="text-zinc-100" />
          </>
        )}
      </div>

      <h2 className="text-lg font-medium text-zinc-200 mt-8 mb-3">Recent Executions</h2>

      {executionsPending ? (
        <div className="flex flex-col gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-zinc-800 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <ExecutionTable rows={executions?.slice(0, 10) ?? []} />
      )}
    </div>
  );
}
