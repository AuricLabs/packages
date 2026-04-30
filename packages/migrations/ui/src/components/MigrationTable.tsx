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
   * When true, rows expose an expand chevron that reveals the run details
   * panel (description, error, result, output). Used on detail pages; off in
   * list views.
   */
  expandableDetails?: boolean;
  /**
   * When true, the expansion panel includes the migration's markdown
   * description. Use on execution-detail pages where there is no per-migration
   * header showing it. Leave off on the migration-detail page where the
   * description is already in the page header.
   */
  showDescriptionInExpansion?: boolean;
  /**
   * When set, clicking the row body toggles row expansion instead of
   * navigating to the migration's detail page. Use on detail pages so the
   * row click drills *into* the run rather than away from the current
   * execution context.
   */
  rowClickExpands?: boolean;
}

export function MigrationTable({
  rows,
  loading,
  expandableDetails,
  showDescriptionInExpansion,
  rowClickExpands,
}: MigrationTableProps) {
  const navigate = useNavigate();

  const handleRowClick = useMemo(() => {
    if (rowClickExpands) return undefined;
    return (row: MigrationRecord) => navigate(`/migrations/${encodeURIComponent(row.id)}`);
  }, [navigate, rowClickExpands]);

  const renderExpansion = useMemo(() => {
    if (!expandableDetails) return undefined;
    return (row: MigrationRecord) => {
      const hasMetadata = row.metadata && Object.keys(row.metadata).length > 0;
      const hasDescription = showDescriptionInExpansion && !!row.description?.trim();
      if (!row.output && !hasMetadata && !row.error && !hasDescription) return null;
      return <RunDetailsPanel record={row} showDescription={showDescriptionInExpansion} />;
    };
  }, [expandableDetails, showDescriptionInExpansion]);

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
