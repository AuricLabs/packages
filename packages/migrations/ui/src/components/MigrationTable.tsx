import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createColumnHelper } from '@tanstack/react-table';
import type { MigrationRecord } from '../api/types';
import { StatusChip } from './StatusChip';
import { TimeAgo } from './TimeAgo';
import { DataTable } from './DataTable';
import { RunDetailsPanel } from './RunDetailsPanel';

const columnHelper = createColumnHelper<MigrationRecord>();

const columns = [
  columnHelper.accessor('id', {
    header: 'ID',
    cell: (info) => (
      <span className="font-mono text-zinc-400">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('name', {
    header: 'Name',
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => (
      <StatusChip status={info.getValue()} direction={info.row.original.direction} />
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
  columnHelper.accessor('duration', {
    header: 'Duration',
    cell: (info) => {
      const value = info.getValue();
      return <span>{value != null ? `${value}ms` : '-'}</span>;
    },
  }),
  columnHelper.accessor('createdAt', {
    header: 'Time',
    cell: (info) => {
      const value = info.getValue();
      return value ? <TimeAgo timestamp={value} /> : <span>-</span>;
    },
  }),
];

interface MigrationTableProps {
  rows: MigrationRecord[];
  loading?: boolean;
  /**
   * When true, rows with output, metadata, or an error expose an expand chevron
   * that reveals the run details panel. Used on the migration detail page;
   * off elsewhere.
   */
  expandableDetails?: boolean;
}

export function MigrationTable({ rows, loading, expandableDetails }: MigrationTableProps) {
  const navigate = useNavigate();

  const handleRowClick = useMemo(
    () => (row: MigrationRecord) => navigate(`/migrations/${encodeURIComponent(row.id)}`),
    [navigate],
  );

  const renderExpansion = useMemo(() => {
    if (!expandableDetails) return undefined;
    return (row: MigrationRecord) => {
      const hasMetadata = row.metadata && Object.keys(row.metadata).length > 0;
      if (!row.output && !hasMetadata && !row.error) return null;
      return <RunDetailsPanel record={row} />;
    };
  }, [expandableDetails]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={loading}
      onRowClick={handleRowClick}
      getRowId={(row) => `${row.id}_${row.direction}_${row.createdAt}`}
      initialSorting={[{ id: 'id', desc: true }]}
      renderExpansion={renderExpansion}
    />
  );
}
