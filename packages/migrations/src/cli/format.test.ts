import { describe, expect, it } from 'vitest';

import { formatDuration, formatRelative, formatTimestamp, indent, pad } from './format';

describe('formatRelative', () => {
  const now = 1_000_000_000_000;

  it('shows seconds for under a minute', () => {
    expect(formatRelative(now - 30_000, now)).toBe('30s ago');
  });

  it('shows minutes for under an hour', () => {
    expect(formatRelative(now - 5 * 60_000, now)).toBe('5m ago');
  });

  it('shows hours for under a day', () => {
    expect(formatRelative(now - 3 * 60 * 60_000, now)).toBe('3h ago');
  });

  it('shows days for under a month', () => {
    expect(formatRelative(now - 5 * 24 * 60 * 60_000, now)).toBe('5d ago');
  });

  it('shows months for under a year', () => {
    expect(formatRelative(now - 90 * 24 * 60 * 60_000, now)).toBe('3mo ago');
  });

  it('handles future timestamps as just-now', () => {
    expect(formatRelative(now + 5_000, now)).toBe('just now');
  });
});

describe('formatDuration', () => {
  it('returns - for undefined', () => {
    expect(formatDuration(undefined)).toBe('-');
  });

  it('returns ms below 1 second', () => {
    expect(formatDuration(450)).toBe('450ms');
  });

  it('returns seconds with 2 decimals when below 10s', () => {
    expect(formatDuration(2500)).toBe('2.50s');
  });

  it('returns seconds with 1 decimal when 10-60s', () => {
    expect(formatDuration(45_000)).toBe('45.0s');
  });

  it('returns minutes for 60s+', () => {
    expect(formatDuration(125_000)).toBe('2m 5s');
  });
});

describe('formatTimestamp', () => {
  it('formats epoch ms as ISO-like string', () => {
    expect(formatTimestamp(0)).toBe('1970-01-01 00:00:00Z');
  });
});

describe('pad', () => {
  it('pads short strings to width', () => {
    expect(pad('hi', 5)).toBe('hi   ');
  });

  it('returns input unchanged when at or above width', () => {
    expect(pad('hello', 3)).toBe('hello');
    expect(pad('hello', 5)).toBe('hello');
  });
});

describe('indent', () => {
  it('prefixes every non-empty line', () => {
    expect(indent('a\nb\nc', 2)).toBe('  a\n  b\n  c');
  });

  it('preserves empty lines without padding', () => {
    expect(indent('a\n\nb', 2)).toBe('  a\n\n  b');
  });
});
