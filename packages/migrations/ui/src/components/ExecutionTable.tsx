import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import Chip from '@mui/material/Chip';
import { useNavigate } from 'react-router-dom';
import type { ExecutionBatch } from '../api/types';
import { TimeAgo } from './TimeAgo';

function getExecutionLabel(status: string, direction: string): string {
  if (status === 'running') return direction === 'down' ? 'Reverting' : 'Running';
  if (status === 'failed') return direction === 'down' ? 'Revert Failed' : 'Failed';
  return direction === 'down' ? 'Reverted' : 'Migrated';
}

function getExecutionColor(status: string, direction: string): 'success' | 'error' | 'info' | 'warning' | 'default' {
  if (status === 'running') return direction === 'down' ? 'warning' : 'info';
  if (status === 'failed') return 'error';
  return direction === 'down' ? 'default' : 'success';
}

const directionColor: Record<string, 'info' | 'warning'> = {
  up: 'info',
  down: 'warning',
};

const columns: GridColDef<ExecutionBatch>[] = [
  { field: 'executionId', headerName: 'Execution ID', flex: 1.5, minWidth: 280 },
  {
    field: 'status',
    headerName: 'Status',
    width: 130,
    renderCell: (params) => (
      <Chip
        label={getExecutionLabel(params.value as string, params.row.direction)}
        color={getExecutionColor(params.value as string, params.row.direction)}
        size="small"
      />
    ),
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
  { field: 'migrationCount', headerName: 'Migrations', width: 110, type: 'number' },
  {
    field: 'startedAt',
    headerName: 'Started',
    width: 160,
    renderCell: (params) => <TimeAgo timestamp={params.value} />,
  },
];

interface ExecutionTableProps {
  rows: ExecutionBatch[];
  loading?: boolean;
}

export function ExecutionTable({ rows, loading }: ExecutionTableProps) {
  const navigate = useNavigate();

  return (
    <DataGrid
      rows={rows}
      columns={columns}
      loading={loading}
      getRowId={(row) => row.executionId}
      onRowClick={(params) => navigate(`/executions/${encodeURIComponent(params.row.executionId)}`)}
      initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
      pageSizeOptions={[10, 25, 50]}
      disableRowSelectionOnClick
      autoHeight
      sx={{ cursor: 'pointer' }}
    />
  );
}
