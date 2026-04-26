import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { useTheme } from '@mui/material/styles';
import { useMigrationStatus, useExecutions } from '../hooks/queries';
import { SummaryCard } from '../components/SummaryCard';
import { ExecutionTable } from '../components/ExecutionTable';

function SummaryCardSkeleton() {
  return (
    <Card sx={{ minWidth: 160, flex: 1 }}>
      <CardContent>
        <Skeleton variant="text" width={80} />
        <Skeleton variant="text" width={60} height={48} />
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const muiTheme = useTheme();
  const { data: executions, isPending: executionsPending, error: executionsError } = useExecutions();
  const hasRunning = executions?.some((e) => e.status === 'running') ?? false;

  const { data: status, isPending: statusPending, error: statusError } = useMigrationStatus(hasRunning);

  const error = statusError || executionsError;
  if (error) return <Alert severity="error">{error.message}</Alert>;

  const pending = status?.pending.length ?? 0;
  const completed = status?.completed.length ?? 0;
  const failed = status?.failed.length ?? 0;
  const total = pending + completed + failed;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        {statusPending ? (
          <>
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
            <SummaryCardSkeleton />
          </>
        ) : (
          <>
            <SummaryCard label="Migrated" count={completed} color={muiTheme.palette.success.main} />
            <SummaryCard label="Pending" count={pending} color={muiTheme.palette.warning.main} />
            <SummaryCard label="Failed" count={failed} color={muiTheme.palette.error.main} />
            <SummaryCard label="Total" count={total} />
          </>
        )}
      </Box>

      <Typography variant="h5" gutterBottom>
        Recent Executions
      </Typography>
      {executionsPending ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={40} />
          ))}
        </Box>
      ) : (
        <ExecutionTable rows={executions?.slice(0, 10) ?? []} />
      )}
    </Box>
  );
}
