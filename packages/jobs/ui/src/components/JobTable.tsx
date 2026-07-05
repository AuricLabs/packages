import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { Ban, RotateCcw } from 'lucide-react';
import type { Job, JobStatus } from '../api/types';
import { StatusChip } from './StatusChip';
import { TimeAgo } from './TimeAgo';
import { DataTable } from './DataTable';

/**
 * Retrying a pending job would double-enqueue it (the job-level CAS prevents
 * a double run, but the loser attempt row is stranded pending forever), so
 * only settled jobs are retryable from the UI.
 */
const RETRYABLE_STATUSES: JobStatus[] = ['failed', 'completed'];

export function canRetry(job: Job): boolean {
  return RETRYABLE_STATUSES.includes(job.status);
}

export function canCancel(job: Job): boolean {
  return job.status === 'pending';
}

const columnHelper = createColumnHelper<Job>();

interface JobTableProps {
  rows: Job[];
  loading?: boolean;
  onRetry: (job: Job) => void;
  onCancel: (job: Job) => void;
}

export function JobTable({ rows, loading, onRetry, onCancel }: JobTableProps) {
  const navigate = useNavigate();

  const columns = useMemo(
    () => [
      columnHelper.accessor('fn', {
        header: 'Function',
        cell: (info) => (
          <span className="font-medium text-zinc-200">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('queue', {
        header: 'Queue',
        cell: (info) => (
          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-full">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <StatusChip status={info.getValue()} />,
        enableSorting: false,
      }),
      columnHelper.accessor('totalAttempts', {
        header: 'Attempts',
      }),
      columnHelper.accessor('createdAt', {
        header: 'Created',
        cell: (info) => <TimeAgo timestamp={info.getValue()} />,
      }),
      columnHelper.accessor('id', {
        header: 'ID',
        cell: (info) => (
          <span className="font-mono text-xs text-zinc-500" title={info.getValue()}>
            {info.getValue().slice(0, 8)}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => {
          const job = info.row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              {job.status === 'failed' && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry(job);
                  }}
                >
                  <RotateCcw className="size-3.5" />
                  Retry
                </button>
              )}
              {canCancel(job) && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel(job);
                  }}
                >
                  <Ban className="size-3.5" />
                  Cancel
                </button>
              )}
            </div>
          );
        },
      }),
    ],
    [onRetry, onCancel],
  );

  const handleRowClick = useMemo(
    () => (row: Job) => navigate(`/jobs/${encodeURIComponent(row.id)}`),
    [navigate],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={loading}
      onRowClick={handleRowClick}
      getRowId={(row) => row.id}
    />
  );
}
