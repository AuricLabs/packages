import type { JobStatus } from '../api/types';
import { getStatusDisplay } from '../api/types';

interface StatusChipProps {
  status: JobStatus;
}

export function StatusChip({ status }: StatusChipProps) {
  const display = getStatusDisplay(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${display.className}`}
    >
      {status === 'running' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
        </span>
      )}
      {display.label}
    </span>
  );
}
