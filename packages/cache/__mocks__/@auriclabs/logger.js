import { jest } from '@jest/globals';

export const __esModule = true;

// Mock the logger
export const logger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
};
