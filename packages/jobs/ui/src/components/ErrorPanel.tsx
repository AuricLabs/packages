import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface ErrorPanelProps {
  error: string;
}

export function ErrorPanel({ error }: ErrorPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(error);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — silently no-op.
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-red-400">Error</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="font-mono text-xs text-red-200 bg-red-500/10 border border-red-500/30 rounded p-3 max-h-96 overflow-auto whitespace-pre-wrap break-words">
        {error}
      </pre>
    </div>
  );
}
