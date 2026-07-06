import type { ReactNode } from 'react';
import type { JobAttempt } from '../api/types';
import { ErrorPanel } from './ErrorPanel';
import { JsonView } from './JsonView';
import { OutputPanel } from './OutputPanel';

interface AttemptDetailsPanelProps {
  attempt: JobAttempt;
}

export function hasAttemptDetails(attempt: JobAttempt): boolean {
  return (
    !!attempt.error ||
    !!attempt.output ||
    attempt.response !== undefined ||
    attempt.state !== undefined ||
    attempt.duration != null ||
    !!attempt.startedAt ||
    !!attempt.scheduledAt ||
    !!attempt.completedAt ||
    !!attempt.failedAt
  );
}

export function AttemptDetailsPanel({ attempt }: AttemptDetailsPanelProps) {
  if (!hasAttemptDetails(attempt)) {
    return (
      <div className="text-xs text-zinc-500 italic py-2">
        No additional details captured for this attempt.
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {attempt.duration != null && <Field label="Duration" value={`${attempt.duration}ms`} />}
        {attempt.scheduledAt && <Field label="Scheduled" value={formatDate(attempt.scheduledAt)} />}
        {attempt.startedAt && <Field label="Started" value={formatDate(attempt.startedAt)} />}
        {attempt.completedAt && <Field label="Completed" value={formatDate(attempt.completedAt)} />}
        {attempt.failedAt && <Field label="Failed" value={formatDate(attempt.failedAt)} />}
      </div>

      {attempt.error && <ErrorPanel error={attempt.error} />}

      {attempt.output && (
        <OutputPanel output={attempt.output} truncated={attempt.outputTruncated} />
      )}

      {attempt.response !== undefined && (
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Response</div>
          <JsonView value={attempt.response} />
        </div>
      )}

      {attempt.state !== undefined && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-zinc-500">State</span>
            <span className="text-xs text-zinc-600">continuation cursor</span>
          </div>
          <JsonView value={attempt.state} />
        </div>
      )}
    </div>
  );
}

interface FieldProps {
  label: string;
  value: ReactNode;
}

function Field({ label, value }: FieldProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="text-zinc-300">{value}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
