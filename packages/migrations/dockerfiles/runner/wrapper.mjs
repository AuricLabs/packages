// Generic migrations-runner entrypoint.
//
// Reads `MIGRATION_BUNDLE_URL` (s3://bucket/key) from env, downloads the
// bundle to /tmp, optionally verifies a SHA256 digest, then execs `node`
// against it. The child inherits the wrapper's env (so the bundle sees
// `MIGRATION_DIRECTION`, `MIGRATION_TARGET`, `MIGRATION_EXECUTION_ID` set
// by the consumer's Lambda dispatcher when calling `task.run`).
//
// All state lives in the user's bundle — this wrapper is pure transport.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

// Live next to /app/node_modules so the bundle's externalised
// `@aws-sdk/*` / `@smithy/*` / `@aws-crypto/*` imports resolve via Node's
// standard upward `node_modules/` walk. Previously /tmp/, which meant the
// walk hit /tmp/node_modules → /node_modules and never reached
// /app/node_modules — so any bundle that imported the AWS SDK died with
// ERR_MODULE_NOT_FOUND before the first migration ran. (NODE_PATH does
// not apply to ESM bare-specifier resolution.)
const BUNDLE_PATH = '/app/migrations-bundle.mjs';
const SHUTDOWN_GRACE_MS = 30_000;

function fail(message, code = 1) {
  process.stderr.write(`[migrations-runner] ${message}\n`);
  process.exit(code);
}

function parseS3Url(url) {
  if (!url.startsWith('s3://')) {
    fail(`MIGRATION_BUNDLE_URL must start with s3:// (got: ${url})`);
  }
  const without = url.slice('s3://'.length);
  const slash = without.indexOf('/');
  if (slash <= 0 || slash === without.length - 1) {
    fail(`MIGRATION_BUNDLE_URL is malformed (expected s3://bucket/key): ${url}`);
  }
  return { Bucket: without.slice(0, slash), Key: without.slice(slash + 1) };
}

async function downloadBundle(url, expectedSha256) {
  const { Bucket, Key } = parseS3Url(url);
  process.stderr.write(`[migrations-runner] Fetching s3://${Bucket}/${Key}\n`);

  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';
  const s3 = new S3Client({ region });
  const res = await s3.send(new GetObjectCommand({ Bucket, Key }));
  if (!res.Body) fail('S3 GetObject returned no body');

  await mkdir(dirname(BUNDLE_PATH), { recursive: true });
  const hash = createHash('sha256');

  // Tee the body into both the file and the digest while streaming.
  const fileStream = createWriteStream(BUNDLE_PATH, { mode: 0o600 });
  await pipeline(
    res.Body,
    async function* (source) {
      for await (const chunk of source) {
        hash.update(chunk);
        yield chunk;
      }
    },
    fileStream,
  );

  const actualSha = hash.digest('hex');
  process.stderr.write(`[migrations-runner] Downloaded bundle (sha256=${actualSha})\n`);

  if (expectedSha256) {
    if (actualSha !== expectedSha256) {
      fail(
        `bundle sha256 mismatch: expected ${expectedSha256}, got ${actualSha}. Refusing to execute.`,
      );
    }
    process.stderr.write(`[migrations-runner] sha256 verified\n`);
  } else {
    process.stderr.write(
      `[migrations-runner] WARNING: MIGRATION_BUNDLE_SHA256 not set; bundle integrity not verified.\n`,
    );
  }
}

function execBundle() {
  const child = spawn('node', [BUNDLE_PATH], {
    stdio: 'inherit',
    env: process.env,
  });

  // Forward signals so SIGINT/SIGTERM from ECS reaches the user's bundle.
  // ECS sends SIGTERM with a configurable stop-timeout (default 30s) before SIGKILL.
  let shuttingDown = false;
  const forward = (sig) => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stderr.write(`[migrations-runner] received ${sig}, forwarding to bundle\n`);
    child.kill(sig);
    setTimeout(() => {
      if (!child.killed) {
        process.stderr.write(`[migrations-runner] grace expired, sending SIGKILL\n`);
        child.kill('SIGKILL');
      }
    }, SHUTDOWN_GRACE_MS).unref();
  };
  process.on('SIGINT', () => forward('SIGINT'));
  process.on('SIGTERM', () => forward('SIGTERM'));

  child.on('error', (err) => {
    fail(`failed to spawn node for bundle: ${err.message}`);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.stderr.write(`[migrations-runner] bundle terminated by ${signal}\n`);
      // Re-raise the signal on ourselves so ECS sees it as the exit cause.
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

async function main() {
  const url = process.env.MIGRATION_BUNDLE_URL;
  if (!url) {
    fail(
      'MIGRATION_BUNDLE_URL is required. Set it on the ECS Task definition (e.g. s3://my-bucket/bundle-<sha>.mjs).',
    );
  }
  const expectedSha = process.env.MIGRATION_BUNDLE_SHA256?.toLowerCase();

  try {
    await downloadBundle(url, expectedSha);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    fail(`failed to download bundle: ${message}`);
  }

  execBundle();
}

void main();
