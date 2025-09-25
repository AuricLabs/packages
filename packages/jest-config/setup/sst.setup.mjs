import { jest } from '@jest/globals';

// Mock the global $interpolate function
global.$interpolate = jest.fn((strings, ...values) => {
  // Simple implementation that mimics string interpolation
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    result += values[i] + (strings[i + 1] || '');
  }
  return result;
});
