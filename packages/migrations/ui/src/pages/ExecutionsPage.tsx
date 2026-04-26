import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useExecutions, useExecutionById } from '../hooks/queries';
import { ExecutionTable } from '../components/ExecutionTable';
import { MigrationTable } from '../components/MigrationTable';

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Skeleton variant="rectangular" height={40} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" height={36} />
      ))}
    </Box>
  );
}

export function ExecutionsPage() {
  const { id } = useParams<{ id: string }>();

  if (id) {
    return <ExecutionDetailView executionId={id} />;
  }
  return <ExecutionsListView />;
}

function ExecutionsListView() {
  const { data: executions = [], isPending, error } = useExecutions();

  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Executions
      </Typography>
      {isPending ? <TableSkeleton rows={8} /> : <ExecutionTable rows={executions} />}
    </Box>
  );
}

function ExecutionDetailView({ executionId }: { executionId: string }) {
  const navigate = useNavigate();
  const { data: records = [], isPending, error } = useExecutionById(executionId);

  if (error) return <Alert severity="error">{error.message}</Alert>;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/executions')} sx={{ mb: 2 }}>
        Back to Executions
      </Button>

      <Typography variant="h4" gutterBottom>
        Execution: {executionId}
      </Typography>

      {isPending ? <TableSkeleton /> : <MigrationTable rows={records} />}
    </Box>
  );
}
