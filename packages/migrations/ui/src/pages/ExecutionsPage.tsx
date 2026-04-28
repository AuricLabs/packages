import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useExecutions, useExecutionById } from '../hooks/queries';
import { ExecutionTable } from '../components/ExecutionTable';
import { MigrationTable } from '../components/MigrationTable';

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="h-10 bg-zinc-800 rounded animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 bg-zinc-800 rounded animate-pulse" />
      ))}
    </div>
  );
}

export function ExecutionsPage() {
  const { id } = useParams<{ id: string }>();

  if (id) {
    return <ExecutionDetailView executionId={id} />;
  }
  return <ExecutionsListView />;
}

function ExecutionsListView() {
  const { data: executions = [], isPending, error } = useExecutions();

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4">
        {error.message}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-100 mb-6">Executions</h1>
      {isPending ? <TableSkeleton rows={8} /> : <ExecutionTable rows={executions} />}
    </div>
  );
}

function ExecutionDetailView({ executionId }: { executionId: string }) {
  const navigate = useNavigate();
  const { data: records = [], isPending, error } = useExecutionById(executionId);

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4">
        {error.message}
      </div>
    );
  }

  return (
    <div>
      <button
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-4"
        onClick={() => navigate('/executions')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Executions
      </button>

      <h1 className="font-mono text-xl text-zinc-100 mb-6">Execution: {executionId}</h1>

      {isPending ? <TableSkeleton /> : <MigrationTable rows={records} />}
    </div>
  );
}
