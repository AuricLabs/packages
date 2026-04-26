import { useState, useEffect } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import { api } from '../api/client';
import { extractName } from '../utils';

interface MigrateDialogProps {
  open: boolean;
  pendingIds: string[];
  onClose: () => void;
  onComplete: () => void;
}

export function MigrateDialog({ open, pendingIds, onClose, onComplete }: MigrateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('all');

  useEffect(() => {
    setSelected('all');
  }, [pendingIds]);

  const runCount =
    selected === 'all'
      ? pendingIds.length
      : pendingIds.indexOf(selected) + 1;

  const handleMigrate = async () => {
    setLoading(true);
    setError(null);
    try {
      const target = selected === 'all' ? undefined : selected;
      await api.migrate(target);
      onComplete();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setSelected('all');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Run Pending Migrations</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {selected === 'all'
            ? `Run ${runCount} pending migration${runCount !== 1 ? 's' : ''}?`
            : `Run ${runCount} migration${runCount !== 1 ? 's' : ''} up to ${extractName(selected)}`}
        </DialogContentText>
        <RadioGroup value={selected} onChange={(e) => setSelected(e.target.value)} sx={{ mt: 1 }}>
          <FormControlLabel value="all" control={<Radio />} label="All pending" />
          {pendingIds.map((id) => (
            <FormControlLabel key={id} value={id} control={<Radio />} label={extractName(id)} />
          ))}
        </RadioGroup>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleMigrate} color="primary" variant="contained" disabled={loading || runCount === 0}>
          {loading ? 'Running...' : 'Run Migrations'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
