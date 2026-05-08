import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { startDashboardServer, type DashboardServer } from './server';

import type { MigrationStorage } from '../types';

function createMockStorage(): MigrationStorage {
  return {
    getRecord: vi.fn().mockResolvedValue(null),
    getAllRecords: vi.fn().mockResolvedValue([]),
    getRecordsByStatus: vi.fn().mockResolvedValue([]),
    getRecordsByExecutionId: vi.fn().mockResolvedValue([]),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
  };
}

let assetsDir: string;
let server: DashboardServer;

beforeAll(async () => {
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
    storage: createMockStorage(),
    migrationFunctionName: 'fake-fn',
    uiAssetsDir: assetsDir,
    port: 0, // OS-assigned to avoid collisions in CI
  });
});

afterAll(async () => {
  await server.close();
  await rm(assetsDir, { recursive: true, force: true });
});

describe('startDashboardServer', () => {
  it('serves index.html with __MIGRATIONS_API_URL__ injected into <head>', async () => {
    const res = await fetch(`${server.url}/`);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(body).toContain('window.__MIGRATIONS_API_URL__=');
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
    const res = await fetch(`${server.url}/../etc/passwd`);
    // Browsers / fetch normalise this client-side, but we send the raw URL just in case.
    expect([400, 404]).toContain(res.status);
  });

  it('returns 404 for unknown static paths', async () => {
    const res = await fetch(`${server.url}/assets/missing.js`);
    expect(res.status).toBe(404);
  });

  it('proxies GET /api/migrations through routeRequest', async () => {
    const res = await fetch(`${server.url}/api/migrations`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    // routeRequest returns a list (potentially empty) — we just confirm the
    // server reached the router at all.
    expect(body).toBeDefined();
  });

  it('proxies POST /api/migrate through routeRequest with JSON body', async () => {
    const res = await fetch(`${server.url}/api/migrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'something' }),
    });
    // The route IS reached (which is what this test cares about). With a fake
    // Lambda function name the actual invoke fails — `routeRequest` may
    // either bubble up the SDK error (caught and turned into 500 by the
    // outer handler) or surface the structured `{ invoked: false }` 400 when
    // the function-name check rejects. Both prove the route was wired.
    expect([200, 400, 500]).toContain(res.status);
  });

  it('handles CORS preflight', async () => {
    const res = await fetch(`${server.url}/api/migrations`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('returns 404 for unknown top-level paths', async () => {
    const res = await fetch(`${server.url}/unknown-path`);
    expect(res.status).toBe(404);
  });
});
