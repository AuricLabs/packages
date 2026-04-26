import Chip from '@mui/material/Chip';
import type { MigrationStatus, MigrationDirection, DisplayStatus } from '../api/types';
import { getDisplayStatus } from '../api/types';

const displayConfig: Record<DisplayStatus, { color: 'success' | 'error' | 'warning' | 'info' | 'default'; label: string }> = {
  pending: { color: 'warning', label: 'Pending' },
  migrated: { color: 'success', label: 'Migrated' },
  running: { color: 'info', label: 'Running' },
  failed: { color: 'error', label: 'Failed' },
  reverting: { color: 'warning', label: 'Reverting' },
  reverted: { color: 'default', label: 'Reverted' },
  revert_failed: { color: 'error', label: 'Revert Failed' },
};

interface StatusChipProps {
  status: MigrationStatus;
  direction: MigrationDirection;
}

export function StatusChip({ status, direction }: StatusChipProps) {
  const display = getDisplayStatus(status, direction);
  const config = displayConfig[display];
  return <Chip label={config.label} color={config.color} size="small" />;
}
