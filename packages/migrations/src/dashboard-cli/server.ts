import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

import { routeRequest } from '../api/router';

import type { MigrationStorage } from '../types';

export interface DashboardServerOptions {
  storage: MigrationStorage;
  /** Resolved deployed Lambda function name — used for migrate/rollback/status invokes. */
  migrationFunctionName: string;
  /** Absolute path to the package's `ui/dist` directory. */
  uiAssetsDir: string;
  /** Port to bind on `127.0.0.1`. Default 3100 (matches Vite dev). */
  port?: number;
  /** Optional logger. Defaults to silent (the CLI prints its own status). */
  log?: (message: string) => void;
}

export interface DashboardServer {
  url: string;
  port: number;
  close: () => Promise<void>;
}

const DEFAULT_PORT = 3100;
const HOST = '127.0.0.1';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/**
 * Spin up the local dashboard server. Same UI bundle as the deployed
 * dashboard; same `routeRequest` behind `/api/*`. The only delta is the
 * `<script>window.__MIGRATIONS_API_URL__ = "..."</script>` that gets injected
 * into `index.html` on every fetch — pointing at this server's own URL.
 */
export async function startDashboardServer(opts: DashboardServerOptions): Promise<DashboardServer> {
  const requestedPort = opts.port ?? DEFAULT_PORT;
  const log =
    opts.log ??
    (() => {
      /* silent by default — the CLI prints its own status */
    });

  // Build a placeholder API URL for the initial injection. We re-inject with
  // the actual bound port (in case `port: 0`) right after `listen`.
  let resolvedUrl = `http://${HOST}:${requestedPort}`;
  let indexHtml = await loadIndexHtml(opts.uiAssetsDir, resolvedUrl);

  const server = createServer((req, res) => {
    handleRequest(req, res, { ...opts, indexHtml, log }).catch((err: unknown) => {
      log(`[dashboard] unhandled: ${err instanceof Error ? err.message : String(err)}`);
      sendJson(res, 500, { error: 'Internal server error' });
    });
  });

  const boundPort = await new Promise<number>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(requestedPort, HOST, () => {
      server.off('error', rejectListen);
      const addr = server.address();
      const port = addr && typeof addr === 'object' ? addr.port : requestedPort;
      resolveListen(port);
    });
  });

  // If the OS assigned an ephemeral port (requested 0), the placeholder URL
  // is wrong — re-inject with the real bound port so window.__MIGRATIONS_API_URL__
  // points at this server.
  if (boundPort !== requestedPort) {
    resolvedUrl = `http://${HOST}:${boundPort}`;
    indexHtml = await loadIndexHtml(opts.uiAssetsDir, resolvedUrl);
  }

  return {
    url: resolvedUrl,
    port: boundPort,
    close: () =>
      new Promise<void>((resolveClose, rejectClose) => {
        server.close((err) => {
          if (err) {
            rejectClose(err);
          } else {
            resolveClose();
          }
        });
      }),
  };
}

async function loadIndexHtml(uiAssetsDir: string, apiUrl: string): Promise<string> {
  const indexPath = join(uiAssetsDir, 'index.html');
  const raw = await readFile(indexPath, 'utf8');
  // Inject the API URL as the very first thing inside <head>, mirroring the
  // sed-based injection the deployed dashboard uses (src/infra/index.ts).
  // Escape the URL for safe HTML embedding.
  const safe = apiUrl.replace(/"/g, '&quot;');
  const inject = `<script>window.__MIGRATIONS_API_URL__="${safe}";</script>`;
  if (raw.includes('window.__MIGRATIONS_API_URL__')) {
    // Already injected — replace to keep the file idempotent.
    return raw.replace(/<script>window\.__MIGRATIONS_API_URL__=[^<]+<\/script>/, inject);
  }
  return raw.replace(/<head>/i, `<head>${inject}`);
}

interface HandleRequestOptions extends DashboardServerOptions {
  indexHtml: string;
  log: (message: string) => void;
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: HandleRequestOptions,
): Promise<void> {
  const method = req.method ?? 'GET';
  const url = req.url ?? '/';

  // Strip query string for path comparisons. Reject anything with `..` to
  // foreclose path traversal cheaply (we also normalise + scope the resolve
  // below, but a fast reject keeps the static-file handler safe to read).
  const [pathOnly] = url.split('?');
  if (pathOnly.includes('..')) {
    sendJson(res, 400, { error: 'Bad request' });
    return;
  }

  // CORS: localhost-only, but be permissive on the same-origin echoes the
  // browser will send. The deployed dashboard's API uses `*` for Allow-Origin
  // (src/api/handler.ts:13–16); we mirror it.
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (pathOnly.startsWith('/api/')) {
    const body = await readBody(req);
    const result = await routeRequest(
      method,
      pathOnly,
      body,
      opts.storage,
      opts.migrationFunctionName,
    );
    sendJson(res, result.statusCode, result.body);
    return;
  }

  if (pathOnly === '/' || pathOnly === '/index.html') {
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    res.end(opts.indexHtml);
    return;
  }

  // Static file from ui/dist. Resolve, then verify the resolved path is
  // contained inside uiAssetsDir to defend against any decoded `..` that
  // slipped past the cheap reject.
  const fileRel = decodeURIComponent(pathOnly.replace(/^\/+/, ''));
  const filePath = resolve(opts.uiAssetsDir, normalize(fileRel));
  const baseDir = resolve(opts.uiAssetsDir) + sep;
  if (!filePath.startsWith(baseDir)) {
    sendJson(res, 400, { error: 'Bad request' });
    return;
  }

  try {
    const data = await readFile(filePath);
    const mime = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch (err) {
    if (isFileNotFoundError(err)) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    throw err;
  }
}

function readBody(req: IncomingMessage): Promise<string | undefined> {
  return new Promise((res, rej) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) {
        res(undefined);
        return;
      }
      res(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', rej);
  });
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function isFileNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  );
}
