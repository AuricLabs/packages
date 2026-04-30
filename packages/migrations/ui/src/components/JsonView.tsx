import { Fragment, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

interface JsonViewProps {
  value: unknown;
  /** Pretty-print indent in spaces. */
  indent?: number;
  /** Optional max-height (Tailwind class). */
  maxHeightClass?: string;
}

export function JsonView({ value, indent = 2, maxHeightClass = 'max-h-96' }: JsonViewProps) {
  const json = serialize(value, indent);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — silently no-op.
    }
  };

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-100 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre
        className={`font-mono text-xs bg-zinc-950 border border-zinc-800 rounded p-3 overflow-auto leading-relaxed text-zinc-300 ${maxHeightClass}`}
      >
        <code>{highlight(json)}</code>
      </pre>
    </div>
  );
}

function serialize(value: unknown, indent: number): string {
  try {
    return JSON.stringify(value, replacer, indent);
  } catch {
    return String(value);
  }
}

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[Function]';
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (typeof value === 'undefined') return null;
  return value;
}

const TOKEN_RE =
  /("(?:\\.|[^"\\])*"(?:\s*:)?)|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function highlight(json: string): ReactNode[] {
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(json)) !== null) {
    if (match.index > lastIndex) {
      out.push(<Fragment key={`p-${i}`}>{json.slice(lastIndex, match.index)}</Fragment>);
    }
    const token = match[0];
    out.push(
      <span key={`t-${i}`} className={classify(token)}>
        {token}
      </span>,
    );
    lastIndex = match.index + token.length;
    i++;
  }

  if (lastIndex < json.length) {
    out.push(<Fragment key="tail">{json.slice(lastIndex)}</Fragment>);
  }

  return out;
}

function classify(token: string): string {
  if (token.startsWith('"')) {
    return /:\s*$/.test(token) ? 'text-sky-400' : 'text-emerald-400';
  }
  if (token === 'true' || token === 'false') return 'text-purple-400';
  if (token === 'null') return 'text-zinc-500 italic';
  return 'text-amber-400';
}
