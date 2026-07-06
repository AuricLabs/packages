import { describe, expect, it } from 'vitest';

import { OutputBuffer } from './output-buffer';

describe('OutputBuffer', () => {
  it('serializes appended messages with timestamp and level', () => {
    const buffer = new OutputBuffer();
    buffer.append('info', 'hello');
    buffer.append('warn', 'world');

    const out = buffer.serialize();
    expect(out).toMatch(/^\[\d{4}-\d{2}-\d{2}T.+Z\] \[info\] hello\n/);
    expect(out).toMatch(/\[\d{4}-\d{2}-\d{2}T.+Z\] \[warn\] world\n$/);
    expect(buffer.truncated).toBe(false);
  });

  it('formats extra args via util.inspect', () => {
    const buffer = new OutputBuffer();
    buffer.append('info', 'rows', { count: 42 });

    expect(buffer.serialize()).toContain('rows { count: 42 }');
  });

  it('handles non-string first message', () => {
    const buffer = new OutputBuffer();
    buffer.append('info', { key: 'value' });

    expect(buffer.serialize()).toContain("{ key: 'value' }");
  });

  it('drops oldest chunks when capacity exceeded and sets truncated flag', () => {
    const buffer = new OutputBuffer(200);
    for (let i = 0; i < 50; i++) {
      buffer.append('info', `line-${i}-${'x'.repeat(20)}`);
    }

    expect(buffer.truncated).toBe(true);
    const out = buffer.serialize();
    // First lines should have been dropped
    expect(out).not.toContain('line-0-');
    // Tail should be preserved
    expect(out).toContain('line-49-');
  });

  it('isEmpty is true initially and false after append', () => {
    const buffer = new OutputBuffer();
    expect(buffer.isEmpty).toBe(true);
    buffer.append('info', 'x');
    expect(buffer.isEmpty).toBe(false);
  });

  it('serialize returns empty string when nothing appended', () => {
    const buffer = new OutputBuffer();
    expect(buffer.serialize()).toBe('');
  });
});

describe('OutputBuffer oversized single line', () => {
  it('keeps the tail of a line larger than the cap instead of dropping it', () => {
    const buffer = new OutputBuffer(128);
    buffer.append('info', 'x'.repeat(1000) + 'THE-END');

    const output = buffer.serialize();
    expect(output).toContain('THE-END');
    expect(Buffer.byteLength(output, 'utf8')).toBeLessThanOrEqual(128);
    expect(buffer.truncated).toBe(true);
    expect(buffer.isEmpty).toBe(false);
  });

  it('stays under the byte cap for multibyte content', () => {
    const buffer = new OutputBuffer(128);
    buffer.append('info', '\u{1F680}'.repeat(500));

    expect(Buffer.byteLength(buffer.serialize(), 'utf8')).toBeLessThanOrEqual(128);
    expect(buffer.truncated).toBe(true);
  });
});
