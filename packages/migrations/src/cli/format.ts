/**
 * Shared formatting helpers for CLI output.
 */

export function formatRelative(timestamp: number, now: number = Date.now()): string {
  const deltaMs = now - timestamp;
  if (deltaMs < 0) return 'just now';

  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) return `${String(seconds)}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${String(minutes)}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${String(days)}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${String(months)}mo ago`;

  const years = Math.floor(days / 365);
  return `${String(years)}y ago`;
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${String(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds - minutes * 60);
  return `${String(minutes)}m ${String(remSeconds)}s`;
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString().replace('T', ' ').slice(0, 19) + 'Z';
}

/** Pad a string to a target column width with spaces. */
export function pad(value: string, width: number): string {
  if (value.length >= width) return value;
  return value + ' '.repeat(width - value.length);
}

/**
 * Indent each line of a multi-line string by the given amount.
 */
export function indent(text: string, spaces: number): string {
  const prefix = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? prefix + line : line))
    .join('\n');
}
