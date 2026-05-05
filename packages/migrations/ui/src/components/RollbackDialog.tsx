import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { api } from '../api/client';
import { extractName } from '../utils';
import { computeRollbackPlan } from './RollbackDialog.logic';

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

  const { orderedIds, rollbackCount, target } = computeRollbackPlan(completedIds, selected);

  const handleRollback = async () => {
    setLoading(true);
    setError(null);
    try {
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
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full z-50">
          <Dialog.Title className="text-lg font-semibold text-zinc-100">
            Confirm Rollback
          </Dialog.Title>
          <Dialog.Description className="text-sm text-zinc-400 mt-1">
            {selected === 'last'
              ? 'Roll back the last completed migration?'
              : `Roll back ${rollbackCount} migration${rollbackCount !== 1 ? 's' : ''} down to ${extractName(selected)}`}
          </Dialog.Description>

          <div className="mt-4 flex flex-col gap-2">
            <label
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                selected === 'last'
                  ? 'border-blue-500 bg-blue-500/5'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <input
                type="radio"
                name="rollback-target"
                value="last"
                checked={selected === 'last'}
                onChange={(e) => setSelected(e.target.value)}
                className="accent-blue-500"
              />
              <span className="text-sm text-zinc-300">Last completed only</span>
            </label>
            {orderedIds.map((id) => (
              <label
                key={id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                  selected === id
                    ? 'border-blue-500 bg-blue-500/5'
                    : 'border-zinc-700 hover:border-zinc-600'
                }`}
              >
                <input
                  type="radio"
                  name="rollback-target"
                  value={id}
                  checked={selected === id}
                  onChange={(e) => setSelected(e.target.value)}
                  className="accent-blue-500"
                />
                <span className="text-sm text-zinc-300">{extractName(id)}</span>
              </label>
            ))}
          </div>

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
              onClick={handleRollback}
              disabled={loading || rollbackCount === 0 || completedIds.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Rolling back...' : 'Rollback'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
