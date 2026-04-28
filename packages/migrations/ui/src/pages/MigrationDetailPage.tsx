import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
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

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4">
        {error.message}
      </div>
    );
  }

  const latestRecord = records[0];
  const showRollback = latestRecord?.status === 'completed' && latestRecord?.direction === 'up';

  return (
    <div>
      <button
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-4"
        onClick={() => navigate('/migrations')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Migrations
      </button>

      <div className="flex justify-between items-center mb-4">
        <h1 className="font-mono text-xl text-zinc-100">{id}</h1>
        {showRollback && (
          <button
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
            onClick={() => setRollbackOpen(true)}
          >
            Rollback
          </button>
        )}
      </div>

      {isPending ? <TableSkeleton rows={5} /> : <MigrationTable rows={records} />}

      <RollbackDialog
        open={rollbackOpen}
        completedIds={id ? [id] : []}
        onClose={() => setRollbackOpen(false)}
        onComplete={() => void queryClient.invalidateQueries({ queryKey: ['migrations', id] })}
      />
    </div>
  );
}
