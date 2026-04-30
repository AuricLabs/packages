import { useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, Hash, Layers, Timer } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMigrationById } from '../hooks/queries';
import { MigrationTable } from '../components/MigrationTable';
import { RollbackDialog } from '../components/RollbackDialog';
import { StatusChip } from '../components/StatusChip';
import { TableSkeleton } from '../components/TableSkeleton';
import { TimeAgo } from '../components/TimeAgo';
import type { MigrationRecord } from '../api/types';

export function MigrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: records = [], isPending, error } = useMigrationById(id);
  const [rollbackOpen, setRollbackOpen] = useState(false);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4">
        {error.message}
      </div>
    );
  }

  const latestRecord = records[0] as MigrationRecord | undefined;
  const showRollback = latestRecord?.status === 'completed' && latestRecord?.direction === 'up';
  const description = latestRecord?.description?.trim();

  return (
    <div>
      <button
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-5"
        onClick={() => navigate('/migrations')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Migrations
      </button>

      <Header
        id={id ?? ''}
        latestRecord={latestRecord}
        runCount={records.length}
        showRollback={showRollback}
        onRollback={() => setRollbackOpen(true)}
      />

      {description && (
        <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Description</div>
          <div className="markdown text-sm text-zinc-300 leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">
            Run history
          </h2>
          <span className="text-xs text-zinc-600">
            {records.length} {records.length === 1 ? 'run' : 'runs'}
          </span>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
          {isPending ? (
            <TableSkeleton rows={5} />
          ) : (
            <MigrationTable rows={records} expandableDetails rowClickExpands />
          )}
        </div>
      </section>

      <RollbackDialog
        open={rollbackOpen}
        completedIds={id ? [id] : []}
        onClose={() => setRollbackOpen(false)}
        onComplete={() => void queryClient.invalidateQueries({ queryKey: ['migrations', id] })}
      />
    </div>
  );
}

interface HeaderProps {
  id: string;
  latestRecord: MigrationRecord | undefined;
  runCount: number;
  showRollback: boolean;
  onRollback: () => void;
}

function Header({ id, latestRecord, runCount, showRollback, onRollback }: HeaderProps) {
  const name = latestRecord?.name ?? id;
  const idDiffersFromName = latestRecord?.name && latestRecord.name !== id;

  return (
    <div className="mb-6 rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 via-zinc-900/50 to-zinc-900/30 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Migration</div>
          <h1 className="text-2xl font-semibold text-zinc-100 mb-1.5 break-all">{name}</h1>
          {idDiffersFromName && (
            <div className="font-mono text-xs text-zinc-500 break-all">{id}</div>
          )}
        </div>
        {showRollback && (
          <button
            className="shrink-0 px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-500 transition-colors"
            onClick={onRollback}
          >
            Rollback
          </button>
        )}
      </div>

      {latestRecord && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-5 pt-5 border-t border-zinc-800/60">
          <StatusChip status={latestRecord.status} direction={latestRecord.direction} />
          <Stat
            icon={<Clock className="size-3.5" />}
            label="Last run"
            value={<TimeAgo timestamp={latestRecord.createdAt} />}
          />
          {latestRecord.duration != null && (
            <Stat
              icon={<Timer className="size-3.5" />}
              label="Duration"
              value={`${latestRecord.duration}ms`}
            />
          )}
          <Stat
            icon={<Layers className="size-3.5" />}
            label="Total runs"
            value={String(runCount)}
          />
          {latestRecord.executionId && (
            <Stat
              icon={<Hash className="size-3.5" />}
              label="Last execution"
              value={
                <span className="font-mono text-xs">
                  {latestRecord.executionId.slice(0, 8)}
                </span>
              }
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
