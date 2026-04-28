import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import type { ExecutionBatch } from '../api/types';
import { TimeAgo } from './TimeAgo';
import { DataTable } from './DataTable';

function getExecutionLabel(status: string, direction: string): string {
  if (status === 'running') return direction === 'down' ? 'Reverting' : 'Running';
  if (status === 'failed') return direction === 'down' ? 'Revert Failed' : 'Failed';
  return direction === 'down' ? 'Reverted' : 'Migrated';
}

function getExecutionBadgeClasses(status: string, direction: string): string {
  const base = 'inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full';
  if (status === 'running') {
    return direction === 'down'
      ? `${base} bg-amber-500/10 text-amber-400 border border-amber-500/30`
      : `${base} bg-blue-500/10 text-blue-400 border border-blue-500/30`;
  }
  if (status === 'failed') {
    return `${base} bg-red-500/10 text-red-400 border border-red-500/30`;
  }
  return direction === 'down'
    ? `${base} bg-zinc-800 text-zinc-400 border border-zinc-700`
    : `${base} bg-emerald-500/10 text-emerald-400 border border-emerald-500/30`;
}

const columnHelper = createColumnHelper<ExecutionBatch>();

const columns = [
  columnHelper.accessor('executionId', {
    header: 'Execution ID',
    cell: (info) => (
      <span className="font-mono text-zinc-400">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => (
      <span className={getExecutionBadgeClasses(info.getValue(), info.row.original.direction)}>
        {getExecutionLabel(info.getValue(), info.row.original.direction)}
      </span>
    ),
    enableSorting: false,
  }),
  columnHelper.accessor('direction', {
    header: 'Direction',
    cell: (info) => (
      <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-full">
        {info.getValue().toUpperCase()}
      </span>
    ),
  }),
  columnHelper.accessor('migrationCount', {
    header: 'Migrations',
  }),
  columnHelper.accessor('startedAt', {
    header: 'Started',
    cell: (info) => <TimeAgo timestamp={info.getValue()} />,
  }),
];

interface ExecutionTableProps {
  rows: ExecutionBatch[];
  loading?: boolean;
}

export function ExecutionTable({ rows, loading }: ExecutionTableProps) {
  const navigate = useNavigate();

  const handleRowClick = useMemo(
    () => (row: ExecutionBatch) => navigate(`/executions/${encodeURIComponent(row.executionId)}`),
    [navigate],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={loading}
      onRowClick={handleRowClick}
      getRowId={(row) => row.executionId}
    />
  );
}
