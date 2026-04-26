import { describe, it, expect, vi, afterEach } from 'vitest';

import { generateTimestamp } from './timestamp';

describe('generateTimestamp', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a 14-character string', () => {
    const result = generateTimestamp();
    expect(result).toHaveLength(14);
  });

  it('returns only digits', () => {
    const result = generateTimestamp();
    expect(result).toMatch(/^\d{14}$/);
  });

  it('formats as YYYYMMDDHHmmss using UTC', () => {
    vi.useFakeTimers();
    // Use Date.UTC to create an unambiguous UTC timestamp
    vi.setSystemTime(new Date(Date.UTC(2025, 5, 1, 9, 15, 22))); // June 1, 2025 09:15:22 UTC

    const result = generateTimestamp();
    expect(result).toBe('20250601091522');
  });

  it('pads single-digit months and days with leading zeros', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2025, 0, 5, 3, 7, 2))); // Jan 5, 2025 03:07:02 UTC

    const result = generateTimestamp();
    expect(result).toBe('20250105030702');
  });

  it('handles end-of-year dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2025, 11, 31, 23, 59, 59))); // Dec 31, 2025 23:59:59 UTC

    const result = generateTimestamp();
    expect(result).toBe('20251231235959');
  });

  it('handles midnight boundary (00:00:00 UTC)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2025, 6, 15, 0, 0, 0))); // July 15, 2025 00:00:00 UTC

    const result = generateTimestamp();
    expect(result).toBe('20250715000000');
  });
});
