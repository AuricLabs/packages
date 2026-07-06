import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Clock, Hash, Layers, ListTree, RotateCcw } from 'lucide-react';
import { useJobById } from '../hooks/queries';
import type { Job } from '../api/types';
import { AttemptTable } from '../components/AttemptTable';
import { CancelDialog } from '../components/CancelDialog';
import { JsonView } from '../components/JsonView';
import { RetryDialog, retryActionLabel } from '../components/RetryDialog';
import { StatusChip } from '../components/StatusChip';
import { TableSkeleton } from '../components/TableSkeleton';
import { TimeAgo } from '../components/TimeAgo';
import { canCancel, canRetry } from '../components/JobTable';

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [retryOpen, setRetryOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payloadOpen, setPayloadOpen] = useState(false);

  const [polling, setPolling] = useState(false);
  const { data, isPending, error } = useJobById(id, polling);

  const job = data?.job;
  const isActive = job?.status === 'pending' || job?.status === 'running';

  useEffect(() => {
    setPolling(isActive);
  }, [isActive]);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4">
        {error.message}
      </div>
    );
  }

  const attempts = data?.attempts ?? [];

  const handleActionComplete = () => {
    void queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  return (
    <div>
      <button
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-5"
        onClick={() => navigate('/jobs')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Jobs
      </button>

      <Header
        id={id ?? ''}
        job={job}
        attemptCount={attempts.length}
        onRetry={() => setRetryOpen(true)}
        onCancel={() => setCancelOpen(true)}
      />

      {job !== undefined && (
        <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setPayloadOpen((open) => !open)}
          >
            <span className="text-xs uppercase tracking-wider text-zinc-500">Payload</span>
            <span className="text-xs text-zinc-600">{payloadOpen ? 'Hide' : 'Show'}</span>
          </button>
          {payloadOpen && (
            <div className="mt-3">
              <JsonView value={job.payload} />
            </div>
          )}
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Attempt history
          </h2>
          <span className="text-xs text-zinc-600">
            {attempts.length} {attempts.length === 1 ? 'attempt' : 'attempts'}
          </span>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
          {isPending ? <TableSkeleton rows={5} /> : <AttemptTable rows={attempts} />}
        </div>
      </section>

      <RetryDialog
        job={retryOpen ? (job ?? null) : null}
        onClose={() => setRetryOpen(false)}
        onComplete={handleActionComplete}
      />
      <CancelDialog
        job={cancelOpen ? (job ?? null) : null}
        onClose={() => setCancelOpen(false)}
        onComplete={handleActionComplete}
      />
    </div>
  );
}

interface HeaderProps {
  id: string;
  job: Job | undefined;
  attemptCount: number;
  onRetry: () => void;
  onCancel: () => void;
}

function Header({ id, job, attemptCount, onRetry, onCancel }: HeaderProps) {
  return (
    <div className="mb-6 rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 via-zinc-900/50 to-zinc-900/30 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Job</div>
          <h1 className="text-2xl font-semibold text-zinc-100 mb-1.5 break-all">
            {job?.fn ?? id}
          </h1>
          <div className="font-mono text-xs text-zinc-500 break-all">{id}</div>
        </div>
        <div className="flex shrink-0 gap-2">
          {job && canRetry(job) && (
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              onClick={onRetry}
            >
              <RotateCcw className="size-4" />
              {retryActionLabel(job)}
            </button>
          )}
          {job && canCancel(job) && (
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-500 transition-colors"
              onClick={onCancel}
            >
              <Ban className="size-4" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {job && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-5 pt-5 border-t border-zinc-800/60">
          <StatusChip status={job.status} />
          <Stat
            icon={<ListTree className="size-3.5" />}
            label="Queue"
            value={<span className="font-mono text-xs">{job.queue}</span>}
          />
          <Stat
            icon={<Clock className="size-3.5" />}
            label="Created"
            value={<TimeAgo timestamp={job.createdAt} />}
          />
          <Stat
            icon={<Layers className="size-3.5" />}
            label="Attempts"
            value={`${attemptCount} recorded / ${job.totalAttempts} total`}
          />
          <Stat
            icon={<Hash className="size-3.5" />}
            label="Updated"
            value={<TimeAgo timestamp={job.updatedAt} />}
          />
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
