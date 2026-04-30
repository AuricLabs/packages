import type { MigrationRecord } from '../api/types';
import { JsonView } from './JsonView';
import { OutputPanel } from './OutputPanel';

interface RunDetailsPanelProps {
  record: MigrationRecord;
}

export function RunDetailsPanel({ record }: RunDetailsPanelProps) {
  const hasMetadata = record.metadata && Object.keys(record.metadata).length > 0;
  const hasOutput = !!record.output;
  const hasError = !!record.error;

  return (
    <div className="space-y-5 py-2">
      {hasError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <div className="text-xs uppercase tracking-wide text-red-400 mb-1">Error</div>
          <div className="font-mono text-xs text-red-200 break-words whitespace-pre-wrap">
            {record.error}
          </div>
        </div>
      )}

      {hasMetadata && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Result</span>
            <span className="text-xs text-zinc-600">returned from {record.direction}()</span>
          </div>
          <JsonView value={record.metadata} />
        </div>
      )}

      {hasOutput && <OutputPanel output={record.output!} truncated={record.outputTruncated} />}
    </div>
  );
}
