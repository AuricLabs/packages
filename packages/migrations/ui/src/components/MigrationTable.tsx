import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import Chip from '@mui/material/Chip';
import { useNavigate } from 'react-router-dom';
import type { MigrationRecord } from '../api/types';
import { StatusChip } from './StatusChip';
import { TimeAgo } from './TimeAgo';

const directionColor: Record<string, 'info' | 'warning'> = {
  up: 'info',
  down: 'warning',
};

const columns: GridColDef<MigrationRecord>[] = [
  { field: 'id', headerName: 'ID', flex: 1.5, minWidth: 200 },
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
  {
    field: 'status',
    headerName: 'Status',
    width: 140,
    renderCell: (params) => <StatusChip status={params.row.status} direction={params.row.direction} />,
  },
  {
    field: 'direction',
    headerName: 'Direction',
    width: 100,
    renderCell: (params) => (
      <Chip
        label={(params.value as string).toUpperCase()}
        color={directionColor[params.value as string] ?? 'default'}
        size="small"
        variant="filled"
      />
    ),
  },
  {
    field: 'duration',
    headerName: 'Duration',
    width: 120,
    valueFormatter: (value: number | undefined) => (value != null ? `${value}ms` : '-'),
  },
  {
    field: 'createdAt',
    headerName: 'Time',
    width: 160,
    renderCell: (params) => (params.value ? <TimeAgo timestamp={params.value} /> : '-'),
  },
];

interface MigrationTableProps {
  rows: MigrationRecord[];
  loading?: boolean;
}

export function MigrationTable({ rows, loading }: MigrationTableProps) {
  const navigate = useNavigate();

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      loading={loading}
      getRowId={(row) => `${row.id}_${row.direction}_${row.createdAt}`}
      onRowClick={(params) => navigate(`/migrations/${encodeURIComponent(params.row.id)}`)}
      initialState={{
        pagination: { paginationModel: { pageSize: 25 } },
        sorting: { sortModel: [{ field: 'id', sort: 'desc' }] },
      }}
      pageSizeOptions={[10, 25, 50]}
      disableRowSelectionOnClick
      autoHeight
      sx={{ cursor: 'pointer' }}
    />
  );
}
