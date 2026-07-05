import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { initJobs } from '../init';

import { startDashboardServer, type DashboardServer } from './server';

let assetsDir: string;
let server: DashboardServer;

beforeAll(async () => {
  // The router's validation paths (bad status / limit / JSON) return before
  // touching DynamoDB, so a fake table name keeps these tests offline.
  initJobs({ tableName: 'fake-table' });

  // Spin up a fake `ui/dist` so the server can read index.html + an asset.
  assetsDir = await mkdtemp(join(tmpdir(), 'dashboard-test-'));
  await writeFile(
    join(assetsDir, 'index.html'),
    '<!doctype html><html><head><title>x</title></head><body><div id="root"></div></body></html>',
    'utf8',
  );
  await mkdir(join(assetsDir, 'assets'), { recursive: true });
  await writeFile(join(assetsDir, 'assets', 'app.js'), 'console.log(1);', 'utf8');

  server = await startDashboardServer({
    uiAssetsDir: assetsDir,
    port: 0, // OS-assigned to avoid collisions in CI
  });
});

afterAll(async () => {
  await server.close();
  await rm(assetsDir, { recursive: true, force: true });
});

describe('startDashboardServer', () => {
  it('serves index.html with __JOBS_API_URL__ injected into <head>', async () => {
    const res = await fetch(`${server.url}/`);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('globalThis.__JOBS_API_URL__=');
    expect(body).toContain(server.url);
    expect(body).toContain('<div id="root"></div>');
  });

  it('serves static assets from the configured ui dir', async () => {
    const res = await fetch(`${server.url}/assets/app.js`);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/javascript');
    expect(body).toBe('console.log(1);');
  });

  it('returns 400 on path traversal attempts', async () => {
    // Encoded dot segments dodge the cheap pre-decode '..' reject but must be
    // caught by the resolved-path containment check. The .txt extension keeps
    // the request out of the SPA fallback.
    const res = await fetch(`${server.url}/assets/%2e%2e/%2e%2e/etc/passwd.txt`);
    expect([400, 404]).toContain(res.status);
  });

  it('returns 404 for unknown static paths', async () => {
    const res = await fetch(`${server.url}/assets/missing.js`);
    expect(res.status).toBe(404);
  });

  it('passes query params from the URL through to routeRequest', async () => {
    // An invalid status is rejected by the router's validation before any
    // DynamoDB call — proving the query string was parsed and forwarded.
    const res = await fetch(`${server.url}/api/jobs?status=bogus`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('Invalid status');
  });

  it('validates limit query param through routeRequest', async () => {
    const res = await fetch(`${server.url}/api/jobs?limit=0`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('limit must be between');
  });

  it('proxies POST /api/jobs/:id/retry through routeRequest with JSON body', async () => {
    // Malformed JSON is rejected by the router before any DynamoDB call —
    // proving the body reached the router.
    const res = await fetch(`${server.url}/api/jobs/some-id/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain('Invalid JSON');
  });

  it('returns 404 for unknown API paths', async () => {
    const res = await fetch(`${server.url}/api/unknown`);
    expect(res.status).toBe(404);
  });

  it('handles CORS preflight', async () => {
    const res = await fetch(`${server.url}/api/jobs`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('serves the SPA shell for extension-less client routes', async () => {
    const res = await fetch(`${server.url}/jobs/some-job-id`);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('globalThis.__JOBS_API_URL__=');
  });
});
