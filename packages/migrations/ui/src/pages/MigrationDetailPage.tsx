import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useQueryClient } from '@tanstack/react-query';
import { useMigrationById } from '../hooks/queries';
import { MigrationTable } from '../components/MigrationTable';
import { RollbackDialog } from '../components/RollbackDialog';
import { TableSkeleton } from '../components/TableSkeleton';

export function MigrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: records = [], isPending, error } = useMigrationById(id);
  const [rollbackOpen, setRollbackOpen] = useState(false);

  if (error) return <Alert severity="error">{error.message}</Alert>;

  const latestRecord = records[0];
  const showRollback = latestRecord?.status === 'completed' && latestRecord?.direction === 'up';

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/migrations')} sx={{ mb: 2 }}>
        Back to Migrations
      </Button>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">{id}</Typography>
        {showRollback && (
          <Button variant="contained" color="error" onClick={() => setRollbackOpen(true)}>
            Rollback
          </Button>
        )}
      </Box>

      {isPending ? <TableSkeleton rows={5} /> : <MigrationTable rows={records} />}

      <RollbackDialog
        open={rollbackOpen}
        completedIds={id ? [id] : []}
        onClose={() => setRollbackOpen(false)}
        onComplete={() => void queryClient.invalidateQueries({ queryKey: ['migrations', id] })}
      />
    </Box>
  );
}
