import { describe, expect, test } from 'vitest';

/**
 * Unit tests for the route path extraction and route formatting logic
 * used in registerApiRoutes. We test the logic directly rather than
 * the full function to avoid needing to mock SST globals, glob, fs,
 * and the API gateway.
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

describe('registerApiRoutes route formatting', () => {
  function formatRoute(file: string, pathPrefix: string): string {
    const method = file.replace(/.*\//, '').replace('.ts', '');
    const routePath = file
      .replace(/(^|\/)(get|post|put|delete|patch)\.ts$/, '')
      .replace(/\\/g, '/')
      .replace(/\/index$/, '');
    return `${method.toUpperCase()} ${pathPrefix}${routePath ? `/${routePath}` : ''}`;
  }

  test('should format route for nested handler with prefix', () => {
    expect(formatRoute('users/get.ts', '/agents')).toBe('GET /agents/users');
    expect(formatRoute('users/profile/post.ts', '/api')).toBe('POST /api/users/profile');
  });

  test('should format route for root-level handler with prefix (no trailing slash)', () => {
    expect(formatRoute('get.ts', '/agents')).toBe('GET /agents');
    expect(formatRoute('post.ts', '/agents')).toBe('POST /agents');
    expect(formatRoute('put.ts', '/agents')).toBe('PUT /agents');
    expect(formatRoute('delete.ts', '/agents')).toBe('DELETE /agents');
    expect(formatRoute('patch.ts', '/agents')).toBe('PATCH /agents');
  });

  test('should format route for root-level handler with empty prefix', () => {
    expect(formatRoute('get.ts', '')).toBe('GET ');
    expect(formatRoute('post.ts', '')).toBe('POST ');
  });

  test('should format route for nested handler with empty prefix', () => {
    expect(formatRoute('users/get.ts', '')).toBe('GET /users');
  });
});
