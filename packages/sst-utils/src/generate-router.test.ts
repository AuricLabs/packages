import fs from 'fs';

import { vol } from 'memfs';
import { describe, expect, beforeEach, test } from 'vitest';

import { generateRouterFile, type RouterRoute } from './generate-router.js';

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

  test('should sort static path segments before parameterized ones', () => {
    fs.mkdirSync('/app/services/billing/api-internal/subscriptions/platform', { recursive: true });
    fs.mkdirSync('/app/services/billing/api-internal/subscriptions/{referenceId}', {
      recursive: true,
    });

    const routes: RouterRoute[] = [
      {
        method: 'get',
        routePath: 'subscriptions/{referenceId}',
        handlerFile: '/app/services/billing/api-internal/subscriptions/{referenceId}/get.ts',
      },
      {
        method: 'get',
        routePath: 'subscriptions/platform/{tenantId}',
        handlerFile: '/app/services/billing/api-internal/subscriptions/platform/{tenantId}/get.ts',
      },
    ];

    generateRouterFile('/app/services/billing/api-internal/_router.ts', routes, '/billing');

    const content = fs.readFileSync('/app/services/billing/api-internal/_router.ts', 'utf-8');
    const platformIdx = content.indexOf("path: '/billing/subscriptions/platform/{tenantId}'");
    const wildcardIdx = content.indexOf("path: '/billing/subscriptions/{referenceId}'");
    expect(platformIdx).toBeGreaterThan(-1);
    expect(wildcardIdx).toBeGreaterThan(-1);
    expect(platformIdx).toBeLessThan(wildcardIdx);
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
