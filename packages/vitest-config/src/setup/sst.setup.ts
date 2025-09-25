import { vi } from 'vitest';

// Mock the global $interpolate function
(
  global as unknown as { $interpolate: (strings: string[], ...values: string[]) => string }
).$interpolate = vi.fn((strings: string[], ...values: string[]) => {
  // Simple implementation that mimics string interpolation
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    result += values[i] + (strings[i + 1] || '');
  }
  return result;
});
