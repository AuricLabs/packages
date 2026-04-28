import type { MigrationStatus, MigrationDirection, DisplayStatus } from '../api/types';
import { getDisplayStatus } from '../api/types';

const displayConfig: Record<DisplayStatus, { className: string; label: string }> = {
  pending: { className: 'bg-amber-500/10 text-amber-400', label: 'Pending' },
  migrated: { className: 'bg-emerald-500/10 text-emerald-400', label: 'Migrated' },
  running: { className: 'bg-blue-500/10 text-blue-400', label: 'Running' },
  failed: { className: 'bg-red-500/10 text-red-400', label: 'Failed' },
  reverting: { className: 'bg-amber-500/10 text-amber-400', label: 'Reverting' },
  reverted: { className: 'bg-zinc-500/10 text-zinc-400', label: 'Reverted' },
  revert_failed: { className: 'bg-red-500/10 text-red-400', label: 'Revert Failed' },
};

interface StatusChipProps {
  status: MigrationStatus;
  direction: MigrationDirection;
}

export function StatusChip({ status, direction }: StatusChipProps) {
  const display = getDisplayStatus(status, direction);
  const config = displayConfig[display];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      {display === 'running' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
        </span>
      )}
      {config.label}
    </span>
  );
}
