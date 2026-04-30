import { type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  CheckCircle2,
  Clock,
  Layers,
  Loader2,
  Timer,
  XCircle,
} from 'lucide-react';
import { useExecutions, useExecutionById } from '../hooks/queries';
import { ExecutionTable } from '../components/ExecutionTable';
import { MigrationTable } from '../components/MigrationTable';
import { TableSkeleton } from '../components/TableSkeleton';
import { TimeAgo } from '../components/TimeAgo';
import type { MigrationRecord } from '../api/types';

export function ExecutionsPage() {
  const { id } = useParams<{ id: string }>();

  if (id) {
    return <ExecutionDetailView executionId={id} />;
  }
  return <ExecutionsListView />;
}

function ExecutionsListView() {
  const { data: executions = [], isPending, error } = useExecutions();

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4">
        {error.message}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-100 mb-6">Executions</h1>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
        {isPending ? <TableSkeleton rows={8} /> : <ExecutionTable rows={executions} />}
      </div>
    </div>
  );
}

function ExecutionDetailView({ executionId }: { executionId: string }) {
  const navigate = useNavigate();
  const { data: records = [], isPending, error } = useExecutionById(executionId);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4">
        {error.message}
      </div>
    );
  }

  return (
    <div>
      <button
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-5"
        onClick={() => navigate('/executions')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Executions
      </button>

      <ExecutionHeader executionId={executionId} records={records} />

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Migrations in this execution
          </h2>
          <span className="text-xs text-zinc-600">
            {records.length} {records.length === 1 ? 'migration' : 'migrations'}
          </span>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
          {isPending ? (
            <TableSkeleton rows={5} />
          ) : (
            <MigrationTable
              rows={records}
              expandableDetails
              showDescriptionInExpansion
              rowClickExpands
            />
          )}
        </div>
      </section>
    </div>
  );
}

interface ExecutionHeaderProps {
  executionId: string;
  records: MigrationRecord[];
}

function ExecutionHeader({ executionId, records }: ExecutionHeaderProps) {
  const stats = computeStats(records);

  return (
    <div className="mb-6 rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 via-zinc-900/50 to-zinc-900/30 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Execution</div>
          <h1 className="font-mono text-xl text-zinc-100 break-all">{executionId}</h1>
        </div>
        {stats.statusBadge}
      </div>

      {records.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-5 pt-5 border-t border-zinc-800/60">
          <Stat
            icon={
              stats.direction === 'down' ? (
                <ArrowDownToLine className="size-3.5" />
              ) : (
                <ArrowUpFromLine className="size-3.5" />
              )
            }
            label="Direction"
            value={stats.direction.toUpperCase()}
          />
          <Stat
            icon={<Clock className="size-3.5" />}
            label="Started"
            value={<TimeAgo timestamp={stats.startedAt} />}
          />
          {stats.totalDurationMs != null && (
            <Stat
              icon={<Timer className="size-3.5" />}
              label="Duration"
              value={formatDuration(stats.totalDurationMs)}
            />
          )}
          <Stat
            icon={<Layers className="size-3.5" />}
            label="Migrations"
            value={`${stats.completedCount} / ${records.length} completed`}
          />
          {stats.failedCount > 0 && (
            <Stat
              icon={<XCircle className="size-3.5 text-red-400" />}
              label="Failed"
              value={<span className="text-red-400">{stats.failedCount}</span>}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface StatProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}

function Stat({ icon, label, value }: StatProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500">{icon}</span>
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}

interface ExecutionStats {
  direction: 'up' | 'down';
  startedAt: number;
  totalDurationMs: number | null;
  completedCount: number;
  failedCount: number;
  runningCount: number;
  statusBadge: ReactNode;
}

function computeStats(records: MigrationRecord[]): ExecutionStats {
  if (records.length === 0) {
    return {
      direction: 'up',
      startedAt: 0,
      totalDurationMs: null,
      completedCount: 0,
      failedCount: 0,
      runningCount: 0,
      statusBadge: null,
    };
  }

  const sorted = [...records].sort((a, b) => a.createdAt - b.createdAt);
  const direction = sorted[0].direction;
  const startedAt = sorted[0].startedAt;

  let completedCount = 0;
  let failedCount = 0;
  let runningCount = 0;
  let totalDurationMs = 0;
  let hasMissingDuration = false;

  for (const record of records) {
    if (record.status === 'completed') completedCount++;
    if (record.status === 'failed') failedCount++;
    if (record.status === 'running') runningCount++;
    if (record.duration != null) {
      totalDurationMs += record.duration;
    } else {
      hasMissingDuration = true;
    }
  }

  return {
    direction,
    startedAt,
    totalDurationMs: hasMissingDuration && runningCount > 0 ? null : totalDurationMs,
    completedCount,
    failedCount,
    runningCount,
    statusBadge: renderStatusBadge({ failedCount, runningCount, direction }),
  };
}

function renderStatusBadge({
  failedCount,
  runningCount,
  direction,
}: {
  failedCount: number;
  runningCount: number;
  direction: 'up' | 'down';
}): ReactNode {
  const base = 'shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border';
  if (runningCount > 0) {
    return (
      <span
        className={`${base} ${
          direction === 'down'
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
        }`}
      >
        <Loader2 className="size-3.5 animate-spin" />
        {direction === 'down' ? 'Reverting' : 'Running'}
      </span>
    );
  }
  if (failedCount > 0) {
    return (
      <span className={`${base} bg-red-500/10 text-red-400 border-red-500/30`}>
        <XCircle className="size-3.5" />
        {direction === 'down' ? 'Revert failed' : 'Failed'}
      </span>
    );
  }
  return (
    <span
      className={`${base} ${
        direction === 'down'
          ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      }`}
    >
      <CheckCircle2 className="size-3.5" />
      {direction === 'down' ? 'Reverted' : 'Migrated'}
    </span>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds - minutes * 60);
  return `${minutes}m ${remSeconds}s`;
}
