import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { api } from '../api/client';
import type { Job } from '../api/types';

interface RetryDialogProps {
  job: Job | null;
  onClose: () => void;
  onComplete: () => void;
}

/** Completed jobs "re-run"; failed jobs "retry" — same endpoint, honest label. */
export function retryActionLabel(job: Job | null): string {
  return job?.status === 'completed' ? 'Re-run' : 'Retry';
}

export function RetryDialog({ job, onClose, onComplete }: RetryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = retryActionLabel(job);

  const handleRetry = async () => {
    if (!job) return;
    setLoading(true);
    setError(null);
    try {
      await api.retryJob(job.id);
      onComplete();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError(null);
    onClose();
  };

  return (
    <Dialog.Root open={!!job} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full z-50">
          <Dialog.Title className="text-lg font-semibold text-zinc-100">
            Confirm {action}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-zinc-400 mt-1">
            Schedule a new attempt for <span className="font-mono text-zinc-300">{job?.fn}</span>?
            The new attempt resumes from the last attempt's continuation state.
          </Dialog.Description>

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRetry}
              disabled={loading || !job}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? action === 'Re-run'
                  ? 'Re-running...'
                  : 'Retrying...'
                : `${action} Job`}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
