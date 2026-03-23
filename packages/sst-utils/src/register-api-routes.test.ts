import { describe, expect, test } from 'vitest';

/**
 * Unit tests for the route path extraction regex used in registerApiRoutes.
 * We test the regex logic directly rather than the full function to avoid
 * needing to mock SST globals, glob, fs, and the API gateway.
 */
describe('registerApiRoutes route path extraction', () => {
  // This is the regex pipeline from registerApiRoutes
  function extractRoutePath(file: string): string {
    return file
      .replace(/(^|\/)(get|post|put|delete|patch)\.ts$/, '')
      .replace(/\\/g, '/')
      .replace(/\/index$/, '');
  }

  test('should extract route path for nested handler files', () => {
    expect(extractRoutePath('users/get.ts')).toBe('users');
    expect(extractRoutePath('users/post.ts')).toBe('users');
    expect(extractRoutePath('users/put.ts')).toBe('users');
    expect(extractRoutePath('users/delete.ts')).toBe('users');
    expect(extractRoutePath('users/patch.ts')).toBe('users');
  });

  test('should extract route path for deeply nested handler files', () => {
    expect(extractRoutePath('users/profile/get.ts')).toBe('users/profile');
    expect(extractRoutePath('api/v1/orders/post.ts')).toBe('api/v1/orders');
  });

  test('should extract empty route path for root-level handler files', () => {
    expect(extractRoutePath('get.ts')).toBe('');
    expect(extractRoutePath('post.ts')).toBe('');
    expect(extractRoutePath('put.ts')).toBe('');
    expect(extractRoutePath('delete.ts')).toBe('');
    expect(extractRoutePath('patch.ts')).toBe('');
  });

  test('should handle index routes', () => {
    expect(extractRoutePath('users/index/get.ts')).toBe('users');
  });

  test('should not strip method names from directory paths', () => {
    expect(extractRoutePath('get/users/get.ts')).toBe('get/users');
    expect(extractRoutePath('delete/items/post.ts')).toBe('delete/items');
  });
});
