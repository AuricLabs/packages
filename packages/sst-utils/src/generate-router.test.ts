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

  // ---- Greedy wildcard vs exact prefix ----

  test('exact path sorts before greedy wildcard with same prefix', () => {
    const routes = [
      route('get', 'agents/{agentId}/files/{path+}'),
      route('get', 'agents/{agentId}/files'),
    ];
    const result = sortedPaths(routes, '/sync');
    // /files must come before /files/{path+} because middy's {proxy+} regex
    // matches zero chars and would swallow the exact /files route
    expect(result).toEqual([
      'GET /sync/agents/{agentId}/files',
      'GET /sync/agents/{agentId}/files/{path+}',
    ]);
  });

  test('exact path sorts before greedy wildcard regardless of input order', () => {
    const routes = [
      route('get', 'agents/{agentId}/files'),
      route('get', 'agents/{agentId}/files/{path+}'),
    ];
    const result = sortedPaths(routes, '/sync');
    expect(result).toEqual([
      'GET /sync/agents/{agentId}/files',
      'GET /sync/agents/{agentId}/files/{path+}',
    ]);
  });

  test('multiple methods with greedy wildcard all sort after exact path', () => {
    const routes = [
      route('put', 'files/{path+}'),
      route('get', 'files/{path+}'),
      route('get', 'files'),
      route('delete', 'files/{path+}'),
    ];
    const result = sortedPaths(routes, '/sync');
    expect(result[0]).toBe('GET /sync/files');
    // All wildcard routes come after
    expect(result.slice(1).every((r) => r.includes('{path+}'))).toBe(true);
  });

  test('non-wildcard longer path still sorts before shorter prefix', () => {
    // Existing behavior must be preserved: longer specific paths sort first
    const routes = [
      route('get', 'agents/{agentId}/files'),
      route('get', 'agents/{agentId}/files/{fileId}/versions'),
    ];
    const result = sortedPaths(routes, '/sync');
    expect(result).toEqual([
      'GET /sync/agents/{agentId}/files/{fileId}/versions',
      'GET /sync/agents/{agentId}/files',
    ]);
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

  // @middy/http-router only recognizes `{proxy+}` as a wildcard catch-all;
  // any other named greedy param (e.g. `{path+}`) makes the router's regex
  // fail to compile at cold start. The generator must rewrite them.
  test('rewrites greedy named path params to {proxy+}', () => {
    fs.mkdirSync('/app/services/files/api/{path+}', { recursive: true });
    const routes: RouterRoute[] = [
      {
        method: 'get',
        routePath: '{path+}',
        handlerFile: '/app/services/files/api/{path+}/get.ts',
      },
    ];

    generateRouterFile('/app/services/files/api/_router.ts', routes, '/files');

    const content = fs.readFileSync('/app/services/files/api/_router.ts', 'utf-8');
    expect(content).toContain("path: '/files/{proxy+}'");
    expect(content).not.toContain("path: '/files/{path+}'");
  });

  test('rewrites greedy named param within nested path', () => {
    fs.mkdirSync('/app/services/storage/api/buckets/{bucket}/objects/{key+}', { recursive: true });
    const routes: RouterRoute[] = [
      {
        method: 'get',
        routePath: 'buckets/{bucket}/objects/{key+}',
        handlerFile: '/app/services/storage/api/buckets/{bucket}/objects/{key+}/get.ts',
      },
    ];

    generateRouterFile('/app/services/storage/api/_router.ts', routes, '/storage');

    const content = fs.readFileSync('/app/services/storage/api/_router.ts', 'utf-8');
    // Only the greedy segment is rewritten; non-greedy {bucket} stays intact
    expect(content).toContain("path: '/storage/buckets/{bucket}/objects/{proxy+}'");
  });

  test('leaves non-greedy named params unchanged', () => {
    fs.mkdirSync('/app/services/users/api/{userId}', { recursive: true });
    const routes: RouterRoute[] = [
      {
        method: 'get',
        routePath: '{userId}',
        handlerFile: '/app/services/users/api/{userId}/get.ts',
      },
    ];

    generateRouterFile('/app/services/users/api/_router.ts', routes, '/users');

    const content = fs.readFileSync('/app/services/users/api/_router.ts', 'utf-8');
    expect(content).toContain("path: '/users/{userId}'");
    expect(content).not.toContain('{proxy+}');
  });

  test('sync service: exact /files route must appear before /files/{proxy+} wildcard (production regression)', () => {
    fs.mkdirSync('/app/services/sync/api', { recursive: true });

    const routes: RouterRoute[] = [
      {
        method: 'get',
        routePath: 'agents/{agentId}/files/{path+}',
        handlerFile: '/app/services/sync/api/agents/{agentId}/files/{path+}/get.ts',
      },
      {
        method: 'put',
        routePath: 'agents/{agentId}/files/{path+}',
        handlerFile: '/app/services/sync/api/agents/{agentId}/files/{path+}/put.ts',
      },
      {
        method: 'get',
        routePath: 'agents/{agentId}/files',
        handlerFile: '/app/services/sync/api/agents/{agentId}/files/get.ts',
      },
      {
        method: 'get',
        routePath: 'agents/{agentId}/manifest',
        handlerFile: '/app/services/sync/api/agents/{agentId}/manifest/get.ts',
      },
    ];

    generateRouterFile('/app/services/sync/api/_router.ts', routes, '/sync');

    const content = fs.readFileSync('/app/services/sync/api/_router.ts', 'utf-8');

    // Greedy param must be rewritten to {proxy+}
    expect(content).toContain("path: '/sync/agents/{agentId}/files/{proxy+}'");
    expect(content).not.toContain("path: '/sync/agents/{agentId}/files/{path+}'");

    // Exact /files must appear BEFORE wildcard /files/{proxy+}
    const exactIdx = content.indexOf("path: '/sync/agents/{agentId}/files'");
    const wildcardIdx = content.indexOf("path: '/sync/agents/{agentId}/files/{proxy+}'");
    expect(exactIdx).toBeGreaterThan(-1);
    expect(wildcardIdx).toBeGreaterThan(-1);
    expect(exactIdx).toBeLessThan(wildcardIdx);
  });

  test('billing internal API: GET platform/{tenantId} must appear before GET {referenceId} (production regression)', () => {
    fs.mkdirSync('/app/services/billing/api-internal', { recursive: true });

    // Exact route set from services/billing/api-internal as deployed to prod
    const routes: RouterRoute[] = [
      {
        method: 'get',
        routePath: 'balance/{tenantId}',
        handlerFile: '/app/services/billing/api-internal/balance/{tenantId}/get.ts',
      },
      {
        method: 'put',
        routePath: 'balance/{tenantId}/auto-recharge',
        handlerFile: '/app/services/billing/api-internal/balance/{tenantId}/auto-recharge/put.ts',
      },
      {
        method: 'get',
        routePath: 'balance/{tenantId}/auto-recharge',
        handlerFile: '/app/services/billing/api-internal/balance/{tenantId}/auto-recharge/get.ts',
      },
      {
        method: 'get',
        routePath: 'balance/{tenantId}/check',
        handlerFile: '/app/services/billing/api-internal/balance/{tenantId}/check/get.ts',
      },
      {
        method: 'post',
        routePath: 'balance/{tenantId}/credit',
        handlerFile: '/app/services/billing/api-internal/balance/{tenantId}/credit/post.ts',
      },
      {
        method: 'post',
        routePath: 'balance/{tenantId}/deduct',
        handlerFile: '/app/services/billing/api-internal/balance/{tenantId}/deduct/post.ts',
      },
      {
        method: 'get',
        routePath: 'balance/{tenantId}/transactions',
        handlerFile: '/app/services/billing/api-internal/balance/{tenantId}/transactions/get.ts',
      },
      {
        method: 'post',
        routePath: 'checkout',
        handlerFile: '/app/services/billing/api-internal/checkout/post.ts',
      },
      {
        method: 'get',
        routePath: 'config',
        handlerFile: '/app/services/billing/api-internal/config/get.ts',
      },
      {
        method: 'post',
        routePath: 'customers',
        handlerFile: '/app/services/billing/api-internal/customers/post.ts',
      },
      {
        method: 'get',
        routePath: 'payment-methods/check/{tenantId}',
        handlerFile: '/app/services/billing/api-internal/payment-methods/check/{tenantId}/get.ts',
      },
      {
        method: 'get',
        routePath: 'payment-methods/{tenantId}',
        handlerFile: '/app/services/billing/api-internal/payment-methods/{tenantId}/get.ts',
      },
      {
        method: 'post',
        routePath: 'pending-promos',
        handlerFile: '/app/services/billing/api-internal/pending-promos/post.ts',
      },
      {
        method: 'get',
        routePath: 'plans',
        handlerFile: '/app/services/billing/api-internal/plans/get.ts',
      },
      {
        method: 'post',
        routePath: 'preflight',
        handlerFile: '/app/services/billing/api-internal/preflight/post.ts',
      },
      {
        method: 'post',
        routePath: 'products',
        handlerFile: '/app/services/billing/api-internal/products/post.ts',
      },
      {
        method: 'post',
        routePath: 'referral-credit',
        handlerFile: '/app/services/billing/api-internal/referral-credit/post.ts',
      },
      {
        method: 'post',
        routePath: 'subscriptions',
        handlerFile: '/app/services/billing/api-internal/subscriptions/post.ts',
      },
      {
        method: 'post',
        routePath: 'subscriptions/dynamic',
        handlerFile: '/app/services/billing/api-internal/subscriptions/dynamic/post.ts',
      },
      {
        method: 'post',
        routePath: 'subscriptions/platform/preview',
        handlerFile: '/app/services/billing/api-internal/subscriptions/platform/preview/post.ts',
      },
      {
        method: 'post',
        routePath: 'subscriptions/platform/seats',
        handlerFile: '/app/services/billing/api-internal/subscriptions/platform/seats/post.ts',
      },
      {
        method: 'get',
        routePath: 'subscriptions/platform/{tenantId}',
        handlerFile: '/app/services/billing/api-internal/subscriptions/platform/{tenantId}/get.ts',
      },
      {
        method: 'post',
        routePath: 'subscriptions/platform-free',
        handlerFile: '/app/services/billing/api-internal/subscriptions/platform-free/post.ts',
      },
      {
        method: 'get',
        routePath: 'subscriptions/{referenceId}',
        handlerFile: '/app/services/billing/api-internal/subscriptions/{referenceId}/get.ts',
      },
      {
        method: 'put',
        routePath: 'subscriptions/{referenceId}/{productKey}',
        handlerFile:
          '/app/services/billing/api-internal/subscriptions/{referenceId}/{productKey}/put.ts',
      },
      {
        method: 'get',
        routePath: 'subscriptions/{referenceId}/{productKey}',
        handlerFile:
          '/app/services/billing/api-internal/subscriptions/{referenceId}/{productKey}/get.ts',
      },
      {
        method: 'delete',
        routePath: 'subscriptions/{referenceId}/{productKey}',
        handlerFile:
          '/app/services/billing/api-internal/subscriptions/{referenceId}/{productKey}/delete.ts',
      },
      {
        method: 'put',
        routePath: 'tenant-discounts/{tenantId}',
        handlerFile: '/app/services/billing/api-internal/tenant-discounts/{tenantId}/put.ts',
      },
      {
        method: 'get',
        routePath: 'tenant-discounts/{tenantId}',
        handlerFile: '/app/services/billing/api-internal/tenant-discounts/{tenantId}/get.ts',
      },
    ];

    generateRouterFile('/app/services/billing/api-internal/_router.ts', routes, '/billing');

    const content = fs.readFileSync('/app/services/billing/api-internal/_router.ts', 'utf-8');

    // Critical: GET platform/{tenantId} must appear before GET {referenceId}
    // to prevent the wildcard swallowing "platform" as a referenceId
    const platformTenantIdx = content.indexOf("path: '/billing/subscriptions/platform/{tenantId}'");
    const refIdx = content.indexOf("path: '/billing/subscriptions/{referenceId}'");
    expect(platformTenantIdx).toBeGreaterThan(-1);
    expect(refIdx).toBeGreaterThan(-1);
    expect(platformTenantIdx).toBeLessThan(refIdx);

    // Static POST routes for platform/* must appear before dynamic GET platform/{tenantId}
    const platformPreviewIdx = content.indexOf("path: '/billing/subscriptions/platform/preview'");
    const platformSeatsIdx = content.indexOf("path: '/billing/subscriptions/platform/seats'");
    expect(platformPreviewIdx).toBeGreaterThan(-1);
    expect(platformSeatsIdx).toBeGreaterThan(-1);
    expect(platformPreviewIdx).toBeLessThan(platformTenantIdx);
    expect(platformSeatsIdx).toBeLessThan(platformTenantIdx);

    // payment-methods/check/{tenantId} must appear before payment-methods/{tenantId}
    const pmCheckIdx = content.indexOf("path: '/billing/payment-methods/check/{tenantId}'");
    const pmIdx = content.indexOf("path: '/billing/payment-methods/{tenantId}'");
    expect(pmCheckIdx).toBeGreaterThan(-1);
    expect(pmIdx).toBeGreaterThan(-1);
    expect(pmCheckIdx).toBeLessThan(pmIdx);
  });
});
