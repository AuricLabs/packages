import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface OutputPanelProps {
  output: string;
  truncated?: boolean;
}

export function OutputPanel({ output, truncated }: OutputPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — silently no-op.
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-zinc-500">Output</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {truncated && (
        <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
          Output exceeded the storage cap. The oldest lines were dropped; the most recent output is shown below.
        </div>
      )}
      <pre className="font-mono text-xs text-zinc-300 bg-zinc-950 border border-zinc-800 rounded p-3 max-h-96 overflow-auto whitespace-pre-wrap break-words">
        {output}
      </pre>
    </div>
  );
}
