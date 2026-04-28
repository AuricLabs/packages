import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
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
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full z-50">
          <Dialog.Title className="text-lg font-semibold text-zinc-100">
            Run Pending Migrations
          </Dialog.Title>
          <Dialog.Description className="text-sm text-zinc-400 mt-1">
            {selected === 'all'
              ? `Run ${runCount} pending migration${runCount !== 1 ? 's' : ''}?`
              : `Run ${runCount} migration${runCount !== 1 ? 's' : ''} up to ${extractName(selected)}`}
          </Dialog.Description>

          <div className="mt-4 flex flex-col gap-2">
            <label
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                selected === 'all'
                  ? 'border-blue-500 bg-blue-500/5'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <input
                type="radio"
                name="migrate-target"
                value="all"
                checked={selected === 'all'}
                onChange={(e) => setSelected(e.target.value)}
                className="accent-blue-500"
              />
              <span className="text-sm text-zinc-300">All pending</span>
            </label>
            {pendingIds.map((id) => (
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
                  name="migrate-target"
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
              onClick={handleMigrate}
              disabled={loading || runCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Running...' : 'Run Migrations'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
