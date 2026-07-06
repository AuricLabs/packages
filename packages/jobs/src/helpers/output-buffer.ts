import { inspect } from 'node:util';

export type OutputLevel = 'info' | 'warn' | 'error' | 'debug';

const DEFAULT_MAX_BYTES = 200 * 1024;

export class OutputBuffer {
  private chunks: string[] = [];
  private chunkBytes: number[] = [];
  private bytes = 0;
  private _truncated = false;

  constructor(private readonly maxBytes: number = DEFAULT_MAX_BYTES) {}

  append(level: OutputLevel, message: unknown, ...rest: unknown[]): void {
    let line = formatLine(level, message, rest);
    let size = Buffer.byteLength(line, 'utf8');

    // A single line larger than the cap would otherwise evict itself and
    // leave the buffer empty — keep its tail instead. Loop because slicing
    // by chars under-counts bytes for multibyte text.
    while (size > this.maxBytes) {
      line = line.slice(-Math.max(1, Math.floor(line.length * (this.maxBytes / size))));
      size = Buffer.byteLength(line, 'utf8');
      this._truncated = true;
    }

    this.chunks.push(line);
    this.chunkBytes.push(size);
    this.bytes += size;

    while (this.bytes > this.maxBytes && this.chunks.length > 0) {
      this.chunks.shift();
      this.bytes -= this.chunkBytes.shift() ?? 0;
      this._truncated = true;
    }
  }

  serialize(): string {
    return this.chunks.join('');
  }

  get truncated(): boolean {
    return this._truncated;
  }

  get isEmpty(): boolean {
    return this.chunks.length === 0;
  }
}

function formatLine(level: OutputLevel, message: unknown, rest: unknown[]): string {
  const ts = new Date().toISOString();
  const head = typeof message === 'string' ? message : formatArg(message);
  const tail = rest.length > 0 ? ' ' + rest.map(formatArg).join(' ') : '';
  return `[${ts}] [${level}] ${head}${tail}\n`;
}

function formatArg(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  return inspect(value, { depth: 4, breakLength: Infinity, colors: false });
}
