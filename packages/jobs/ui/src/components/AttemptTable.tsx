import { createColumnHelper } from '@tanstack/react-table';
import type { JobAttempt } from '../api/types';
import { StatusChip } from './StatusChip';
import { TimeAgo } from './TimeAgo';
import { DataTable } from './DataTable';
import { AttemptDetailsPanel, hasAttemptDetails } from './AttemptDetailsPanel';

const columnHelper = createColumnHelper<JobAttempt>();

const columns = [
  columnHelper.accessor('attempt', {
    header: 'Attempt',
    cell: (info) => (
      <span className="font-mono text-zinc-400">#{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusChip status={info.getValue()} />,
    enableSorting: false,
  }),
  columnHelper.accessor('duration', {
    header: 'Duration',
    cell: (info) => {
      const value = info.getValue();
      return <span>{value != null ? `${value}ms` : '-'}</span>;
    },
  }),
  columnHelper.accessor('createdAt', {
    header: 'Created',
    cell: (info) => <TimeAgo timestamp={info.getValue()} />,
  }),
];

interface AttemptTableProps {
  rows: JobAttempt[];
  loading?: boolean;
}

export function AttemptTable({ rows, loading }: AttemptTableProps) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={loading}
      getRowId={(row) => `${row.jobId}_${row.attempt}`}
      initialSorting={[{ id: 'attempt', desc: true }]}
      renderExpansion={(row) =>
        hasAttemptDetails(row) ? <AttemptDetailsPanel attempt={row} /> : null
      }
    />
  );
}
