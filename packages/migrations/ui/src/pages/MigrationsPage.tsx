import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMigrations, useMigrationStatus } from '../hooks/queries';
import type { MigrationRecord, DisplayStatus } from '../api/types';
import { getDisplayStatus } from '../api/types';
import { MigrationTable } from '../components/MigrationTable';
import { MigrateDialog } from '../components/MigrateDialog';
import { RollbackDialog } from '../components/RollbackDialog';
import { TableSkeleton } from '../components/TableSkeleton';
import { MIGRATION_ID_REGEX } from '../utils';

const STATUS_OPTIONS: (DisplayStatus | 'all')[] = [
  'all',
  'pending',
  'migrated',
  'reverted',
  'running',
  'failed',
  'reverting',
  'revert_failed',
];

const STATUS_LABELS: Record<DisplayStatus | 'all', string> = {
  all: 'All',
  pending: 'Pending',
  migrated: 'Migrated',
  reverted: 'Reverted',
  running: 'Running',
  failed: 'Failed',
  reverting: 'Reverting',
  revert_failed: 'Revert Failed',
};

function buildPendingRecord(id: string): MigrationRecord {
  const match = MIGRATION_ID_REGEX.exec(id);
  const name = match ? match[2] : id;
  return {
    id,
    name,
    status: 'pending',
    direction: 'up',
    startedAt: 0,
    executionId: '',
    createdAt: 0,
    updatedAt: 0,
  };
}

const POLLING_GRACE_MS = 10_000;

export function MigrationsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | 'all'>('all');
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [polling, setPolling] = useState(false);
  const triggerTimeRef = useRef<number>(0);

  const { data: dbMigrations = [], isPending: migrationsPending, error: migrationsError } = useMigrations(polling);
  const { data: status, isPending: statusPending, error: statusError } = useMigrationStatus(polling);

  const hasRunning = dbMigrations.some((m) => m.status === 'running');

  useEffect(() => {
    if (!polling) return;
    const gracePeriodActive = Date.now() - triggerTimeRef.current < POLLING_GRACE_MS;
    if (!hasRunning && !gracePeriodActive) {
      setPolling(false);
    }
  }, [polling, hasRunning]);

  const isPending = migrationsPending || statusPending;

  // Merge DB records with pending migrations from the runner
  const migrations = (() => {
    const dbIds = new Set(dbMigrations.map((m) => m.id));
    const pendingRows = (status?.pending ?? [])
      .filter((id) => !dbIds.has(id))
      .map(buildPendingRecord);
    return [...dbMigrations, ...pendingRows].sort((a, b) => a.id.localeCompare(b.id));
  })();

  const filtered =
    statusFilter === 'all' ? migrations : migrations.filter((m) => getDisplayStatus(m.status, m.direction) === statusFilter);

  const error = migrationsError || statusError;
  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4">
        {error.message}
      </div>
    );
  }

  const handleTrigger = () => {
    triggerTimeRef.current = Date.now();
    setPolling(true);
    void queryClient.invalidateQueries({ queryKey: ['migrations'] });
    // The Lambda is invoked asynchronously, so records won't exist yet.
    // Schedule a follow-up refetch to catch the initial state change.
    setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ['migrations'] });
    }, 1_500);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Migrations</h1>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!status || status.pending.length === 0}
            onClick={() => setMigrateOpen(true)}
          >
            Run Migrations
          </button>
          <button
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!status || status.completed.length === 0}
            onClick={() => setRollbackOpen(true)}
          >
            Rollback
          </button>
        </div>
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
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {isPending ? <TableSkeleton /> : <MigrationTable rows={filtered} />}

      <MigrateDialog
        open={migrateOpen}
        pendingIds={status?.pending ?? []}
        onClose={() => setMigrateOpen(false)}
        onComplete={handleTrigger}
      />

      <RollbackDialog
        open={rollbackOpen}
        completedIds={status?.completed ?? []}
        onClose={() => setRollbackOpen(false)}
        onComplete={handleTrigger}
      />
    </div>
  );
}
