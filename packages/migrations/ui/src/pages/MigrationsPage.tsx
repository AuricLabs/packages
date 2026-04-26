import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import type { SelectChangeEvent } from '@mui/material/Select';
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
  if (error) return <Alert severity="error">{error.message}</Alert>;

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
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Migrations</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            color="primary"
            disabled={!status || status.pending.length === 0}
            onClick={() => setMigrateOpen(true)}
          >
            Run Migrations
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={!status || status.completed.length === 0}
            onClick={() => setRollbackOpen(true)}
          >
            Rollback
          </Button>
        </Box>
      </Box>

      <FormControl sx={{ mb: 2, minWidth: 160 }} size="small">
        <InputLabel>Status</InputLabel>
        <Select
          value={statusFilter}
          label="Status"
          onChange={(e: SelectChangeEvent) =>
            setStatusFilter(e.target.value as DisplayStatus | 'all')
          }
        >
          {STATUS_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

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
    </Box>
  );
}
