import fs from 'fs';

import { vol } from 'memfs';
import { describe, expect, beforeEach, test } from 'vitest';

import {
  generateRouterFile,
  sortRoutesBySpecificity,
  type RouterRoute,
} from './generate-router.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal RouterRoute (handlerFile doesn't matter for sorting)
// ---------------------------------------------------------------------------
const route = (method: string, routePath: string): RouterRoute => ({
  method,
  routePath,
  handlerFile: `/app/api/${routePath || 'root'}/handler.ts`,
});

/** Extract ordered route paths from sortRoutesBySpecificity output */
const sortedPaths = (routes: RouterRoute[], prefix = '/billing'): string[] =>
  sortRoutesBySpecificity(routes, prefix).map(
    (r) => `${r.method.toUpperCase()} ${prefix}${r.routePath ? `/${r.routePath}` : ''}`,
  );

// ---------------------------------------------------------------------------
// sortRoutesBySpecificity — exhaustive coverage
// ---------------------------------------------------------------------------
describe('sortRoutesBySpecificity', () => {
  // ---- Static vs dynamic at same depth ----

  test('static segment sorts before parameterized at same depth', () => {
    const routes = [route('get', '{referenceId}'), route('get', 'platform')];
    const result = sortedPaths(routes);
    expect(result).toEqual(['GET /billing/platform', 'GET /billing/{referenceId}']);
  });

  test('static segment sorts before parameterized in nested paths', () => {
    const routes = [
      route('get', 'subscriptions/{referenceId}'),
      route('get', 'subscriptions/platform/{tenantId}'),
    ];
    const result = sortedPaths(routes);
    expect(result).toEqual([
      'GET /billing/subscriptions/platform/{tenantId}',
      'GET /billing/subscriptions/{referenceId}',
    ]);
  });

  // ---- Longer path before shorter prefix ----

  test('longer specific path sorts before shorter prefix path', () => {
    const routes = [route('post', 'subscriptions'), route('post', 'subscriptions/platform-free')];
    const result = sortedPaths(routes);
    expect(result).toEqual([
      'POST /billing/subscriptions/platform-free',
      'POST /billing/subscriptions',
    ]);
  });

  test('multiple longer paths all sort before their shared prefix', () => {
    const routes = [
      route('post', 'subscriptions'),
      route('post', 'subscriptions/platform-free'),
      route('post', 'subscriptions/dynamic'),
    ];
    const result = sortedPaths(routes);
    expect(result).toEqual([
      'POST /billing/subscriptions/dynamic',
      'POST /billing/subscriptions/platform-free',
      'POST /billing/subscriptions',
    ]);
  });

  // ---- Mixed: longer path with params vs shorter static prefix ----

  test('longer parameterized path sorts before shorter static prefix', () => {
    const routes = [route('get', 'subscriptions'), route('get', 'subscriptions/{referenceId}')];
    const result = sortedPaths(routes);
    expect(result).toEqual([
      'GET /billing/subscriptions/{referenceId}',
      'GET /billing/subscriptions',
    ]);
  });

  // ---- Deeply nested paths ----

  test('deeply nested paths sort by specificity at each level', () => {
    const routes = [
      route('get', 'subscriptions/{referenceId}/{productKey}'),
      route('get', 'subscriptions/{referenceId}'),
      route('get', 'subscriptions/platform/{tenantId}'),
      route('get', 'subscriptions'),
    ];
    const result = sortedPaths(routes);
    expect(result).toEqual([
      'GET /billing/subscriptions/platform/{tenantId}',
      'GET /billing/subscriptions/{referenceId}/{productKey}',
      'GET /billing/subscriptions/{referenceId}',
      'GET /billing/subscriptions',
    ]);
  });

  // ---- Full billing internal API (real-world regression test) ----

  test('billing internal API routes sort correctly (production regression)', () => {
    const routes = [
      route('post', 'subscriptions'),
      route('post', 'subscriptions/dynamic'),
      route('post', 'subscriptions/platform-free'),
      route('post', 'subscriptions/platform/preview'),
      route('post', 'subscriptions/platform/seats'),
      route('get', 'subscriptions/platform/{tenantId}'),
      route('get', 'subscriptions/{referenceId}'),
      route('get', 'subscriptions/{referenceId}/{productKey}'),
      route('put', 'subscriptions/{referenceId}/{productKey}'),
      route('delete', 'subscriptions/{referenceId}/{productKey}'),
    ];
    const result = sortedPaths(routes);

    // All specific POST routes must come before generic POST /subscriptions
    const genericPostIdx = result.indexOf('POST /billing/subscriptions');
    const platformFreeIdx = result.indexOf('POST /billing/subscriptions/platform-free');
    const dynamicIdx = result.indexOf('POST /billing/subscriptions/dynamic');
    expect(platformFreeIdx).toBeLessThan(genericPostIdx);
    expect(dynamicIdx).toBeLessThan(genericPostIdx);

    // Static "platform" must come before parameterized at same depth
    const platformTenantIdx = result.indexOf('GET /billing/subscriptions/platform/{tenantId}');
    const getRefIdx = result.indexOf('GET /billing/subscriptions/{referenceId}');
    expect(platformTenantIdx).toBeLessThan(getRefIdx);
  });

  // ---- Root route handling ----

  test('root route (empty routePath) sorts after all other routes', () => {
    const routes = [route('get', ''), route('get', 'health'), route('get', '{id}')];
    const result = sortedPaths(routes, '/api');
    expect(result).toEqual(['GET /api/health', 'GET /api/{id}', 'GET /api']);
  });

  // ---- Same paths, different methods ----

  test('routes with same path but different methods maintain stable order', () => {
    const routes = [
      route('get', 'subscriptions/{referenceId}/{productKey}'),
      route('put', 'subscriptions/{referenceId}/{productKey}'),
      route('delete', 'subscriptions/{referenceId}/{productKey}'),
    ];
    const result = sortedPaths(routes);
    // All same specificity — stable sort preserves insertion order
    expect(result).toEqual([
      'GET /billing/subscriptions/{referenceId}/{productKey}',
      'PUT /billing/subscriptions/{referenceId}/{productKey}',
      'DELETE /billing/subscriptions/{referenceId}/{productKey}',
    ]);
  });

  // ---- Alphabetical ordering of static segments ----

  test('static segments at same depth sort alphabetically', () => {
    const routes = [route('get', 'plans'), route('get', 'balance'), route('get', 'config')];
    const result = sortedPaths(routes);
    expect(result).toEqual(['GET /billing/balance', 'GET /billing/config', 'GET /billing/plans']);
  });

  // ---- Empty prefix ----

  test('works with empty path prefix', () => {
    const routes = [route('get', 'users/{id}'), route('get', 'users/me')];
    const result = sortedPaths(routes, '');
    expect(result).toEqual(['GET /users/me', 'GET /users/{id}']);
  });

  // ---- Single route ----

  test('single route returns unchanged', () => {
    const routes = [route('get', 'health')];
    const result = sortedPaths(routes, '/api');
    expect(result).toEqual(['GET /api/health']);
  });

  // ---- Idempotent: already sorted input ----

  test('already sorted input remains in same order', () => {
    const routes = [
      route('get', 'subscriptions/platform/{tenantId}'),
      route('get', 'subscriptions/{referenceId}'),
      route('get', 'subscriptions'),
    ];
    const first = sortedPaths(routes);
    const second = sortedPaths(routes);
    expect(first).toEqual(second);
  });

  // ---- Does not mutate input ----

  test('does not mutate the input array', () => {
    const routes = [route('get', '{id}'), route('get', 'specific')];
    const original = [...routes];
    sortRoutesBySpecificity(routes, '/api');
    expect(routes).toEqual(original);
  });

  // ---- Multi-level param vs static nesting ----

  test('multiple param segments sort after mixed static/param paths', () => {
    const routes = [
      route('get', '{orgId}/{teamId}/{projectId}'),
      route('get', '{orgId}/teams/{teamId}'),
      route('get', 'admin/teams/all'),
    ];
    const result = sortedPaths(routes, '/orgs');
    expect(result).toEqual([
      'GET /orgs/admin/teams/all',
      'GET /orgs/{orgId}/teams/{teamId}',
      'GET /orgs/{orgId}/{teamId}/{projectId}',
    ]);
  });

  // ---- Hyphenated static segments (the platform-free case) ----

  test('hyphenated static segments are not treated as dynamic', () => {
    const routes = [
      route('post', 'items'),
      route('post', 'items/bulk-create'),
      route('post', 'items/{id}/archive'),
    ];
    const result = sortedPaths(routes, '/api');
    expect(result).toEqual([
      'POST /api/items/bulk-create',
      'POST /api/items/{id}/archive',
      'POST /api/items',
    ]);
  });
});

// ---------------------------------------------------------------------------
// generateRouterFile — file generation tests
// ---------------------------------------------------------------------------
describe('generateRouterFile', () => {
  beforeEach(() => {
    vol.reset();
    // Create the base directory
    fs.mkdirSync('/app/services/agents/api', { recursive: true });
  });

  test('should generate a router file with correct imports and routes', () => {
    const routes: RouterRoute[] = [
      { method: 'get', routePath: '', handlerFile: '/app/services/agents/api/get.ts' },
      { method: 'post', routePath: '', handlerFile: '/app/services/agents/api/post.ts' },
      { method: 'get', routePath: '{id}', handlerFile: '/app/services/agents/api/{id}/get.ts' },
    ];

    const handlerPath = generateRouterFile(
      '/app/services/agents/api/_router.ts',
      routes,
      '/agents',
    );

    expect(handlerPath).toBe('/app/services/agents/api/_router.handler');

    const content = fs.readFileSync('/app/services/agents/api/_router.ts', 'utf-8');
    expect(content).toContain("import middy from '@middy/core'");
    expect(content).toContain("import httpRouterHandler from '@middy/http-router'");
    expect(content).toContain("path: '/agents'");
    expect(content).toContain("method: 'GET'");
    expect(content).toContain("method: 'POST'");
    expect(content).toContain("path: '/agents/{id}'");
    expect(content).toContain("await import('./get.js')");
    expect(content).toContain("await import('./post.js')");
    expect(content).toContain("await import('./{id}/get.js')");
    expect(content).toContain('export const handler = middy().handler(httpRouterHandler(routes))');
  });

  test('should handle deeply nested routes', () => {
    const routes: RouterRoute[] = [
      {
        method: 'post',
        routePath: '{id}/integrations/{integrationId}/config',
        handlerFile: '/app/services/agents/api/{id}/integrations/{integrationId}/config/post.ts',
      },
    ];

    generateRouterFile('/app/services/agents/api/_router.ts', routes, '/agents');

    const content = fs.readFileSync('/app/services/agents/api/_router.ts', 'utf-8');
    expect(content).toContain("path: '/agents/{id}/integrations/{integrationId}/config'");
    expect(content).toContain("await import('./{id}/integrations/{integrationId}/config/post.js')");
  });

  test('should generate auto-generated header comment', () => {
    const routes: RouterRoute[] = [
      { method: 'get', routePath: '', handlerFile: '/app/services/agents/api/get.ts' },
    ];

    generateRouterFile('/app/services/agents/api/_router.ts', routes, '/agents');

    const content = fs.readFileSync('/app/services/agents/api/_router.ts', 'utf-8');
    expect(content).toMatch(/^\/\/ Auto-generated/);
  });

  test('should handle empty path prefix', () => {
    fs.mkdirSync('/app/api/health', { recursive: true });
    const routes: RouterRoute[] = [
      { method: 'get', routePath: 'health', handlerFile: '/app/api/health/get.ts' },
    ];

    generateRouterFile('/app/api/_router.ts', routes, '');

    const content = fs.readFileSync('/app/api/_router.ts', 'utf-8');
    expect(content).toContain("path: '/health'");
  });

  test('should sort routes by specificity in generated file', () => {
    fs.mkdirSync('/app/services/billing/api-internal/subscriptions/platform-free', {
      recursive: true,
    });

    const routes: RouterRoute[] = [
      {
        method: 'post',
        routePath: 'subscriptions',
        handlerFile: '/app/services/billing/api-internal/subscriptions/post.ts',
      },
      {
        method: 'post',
        routePath: 'subscriptions/platform-free',
        handlerFile: '/app/services/billing/api-internal/subscriptions/platform-free/post.ts',
      },
    ];

    generateRouterFile('/app/services/billing/api-internal/_router.ts', routes, '/billing');

    const content = fs.readFileSync('/app/services/billing/api-internal/_router.ts', 'utf-8');
    const platformFreeIdx = content.indexOf("path: '/billing/subscriptions/platform-free'");
    const genericIdx = content.indexOf("path: '/billing/subscriptions'");
    expect(platformFreeIdx).toBeGreaterThan(-1);
    expect(genericIdx).toBeGreaterThan(-1);
    expect(platformFreeIdx).toBeLessThan(genericIdx);
  });

  test('should handle root route with empty prefix', () => {
    fs.mkdirSync('/app/api', { recursive: true });
    const routes: RouterRoute[] = [
      { method: 'get', routePath: '', handlerFile: '/app/api/get.ts' },
    ];

    generateRouterFile('/app/api/_router.ts', routes, '');

    const content = fs.readFileSync('/app/api/_router.ts', 'utf-8');
    expect(content).toContain("path: '/'");
  });
});
