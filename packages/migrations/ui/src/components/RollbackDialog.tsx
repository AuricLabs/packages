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

interface RollbackDialogProps {
  open: boolean;
  completedIds: string[];
  onClose: () => void;
  onComplete: () => void;
}

export function RollbackDialog({ open, completedIds, onClose, onComplete }: RollbackDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('last');

  useEffect(() => {
    setSelected('last');
  }, [completedIds]);

  // completedIds is most-recent-first; rolling back from the first element down to the selected one
  const rollbackCount =
    selected === 'last'
      ? 1
      : completedIds.indexOf(selected) + 1;

  const handleRollback = async () => {
    setLoading(true);
    setError(null);
    try {
      const target = selected === 'last' ? undefined : selected;
      await api.rollback(target);
      onComplete();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setSelected('last');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Confirm Rollback</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {selected === 'last'
            ? 'Roll back the last completed migration?'
            : `Roll back ${rollbackCount} migration${rollbackCount !== 1 ? 's' : ''} down to ${extractName(selected)}`}
        </DialogContentText>
        <RadioGroup value={selected} onChange={(e) => setSelected(e.target.value)} sx={{ mt: 1 }}>
          <FormControlLabel value="last" control={<Radio />} label="Last completed only" />
          {completedIds.map((id) => (
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
        <Button onClick={handleRollback} color="error" variant="contained" disabled={loading || rollbackCount === 0 || completedIds.length === 0}>
          {loading ? 'Rolling back...' : 'Rollback'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
