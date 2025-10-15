import { vi } from 'vitest';

// Mock the logger
export const logger = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  trace: vi.fn(),
};
