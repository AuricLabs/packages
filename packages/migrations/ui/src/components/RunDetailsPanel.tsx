import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MigrationRecord } from '../api/types';
import { JsonView } from './JsonView';
import { OutputPanel } from './OutputPanel';

interface RunDetailsPanelProps {
  record: MigrationRecord;
  /**
   * When true, renders the migration's markdown description at the top of the
   * panel. Useful in execution-detail views where there's no per-migration
   * header showing it. Off when the parent page already displays it.
   */
  showDescription?: boolean;
}

export function RunDetailsPanel({ record, showDescription }: RunDetailsPanelProps) {
  const description = showDescription ? record.description?.trim() : undefined;
  const hasMetadata = record.metadata && Object.keys(record.metadata).length > 0;
  const hasOutput = !!record.output;
  const hasError = !!record.error;
  const hasContent = !!description || hasMetadata || hasOutput || hasError;

  if (!hasContent) {
    return (
      <div className="text-xs text-zinc-500 italic py-2">
        No additional details captured for this run.
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      {description && (
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Description</div>
          <div className="markdown text-sm text-zinc-300 leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
          </div>
        </div>
      )}

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
