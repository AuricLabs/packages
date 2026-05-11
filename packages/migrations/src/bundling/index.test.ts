import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { bundleMigrations, DEFAULT_BUNDLE_EXTERNALS } from './index';

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'bundle-migrations-test-'));

  // Tiny migrations registry: a single migration object exported via
  // `defineMigrations`-style shape. The fixture entry imports it.
  await writeFile(
    join(workDir, 'sample-migration.ts'),
    `export default {
  name: 'sample',
  async up() {},
  async down() {},
};
`,
    'utf8',
  );

  await writeFile(
    join(workDir, 'fargate-entry.ts'),
    `import migration from './sample-migration';

// Reference the migration so esbuild keeps it in the bundle.
export const registry = { sample: migration };
export const ranAt = Date.now();
`,
    'utf8',
  );
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('bundleMigrations', () => {
  it('produces a single ESM file with deterministic SHA across runs', async () => {
    const out1 = join(workDir, 'dist1', 'bundle.mjs');
    const out2 = join(workDir, 'dist2', 'bundle.mjs');

    const r1 = await bundleMigrations({
      entryPoint: 'fargate-entry.ts',
      outFile: out1,
      cwd: workDir,
    });
    const r2 = await bundleMigrations({
      entryPoint: 'fargate-entry.ts',
      outFile: out2,
      cwd: workDir,
    });

    expect(r1.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r1.sha256).toBe(r2.sha256);
    expect(r1.size).toBe(r2.size);
    expect(r1.size).toBeGreaterThan(0);

    const contents = await readFile(out1, 'utf8');
    expect(contents).toContain('async up()');
    expect(contents).toContain('sample-migration');
  });

  it('injects the CommonJS interop banner for ESM-bundled CJS deps', async () => {
    const out = join(workDir, 'dist', 'bundle.mjs');
    await bundleMigrations({
      entryPoint: 'fargate-entry.ts',
      outFile: out,
      cwd: workDir,
    });
    const contents = await readFile(out, 'utf8');
    expect(contents).toContain("import { createRequire as __cjsCreateRequire } from 'node:module'");
    expect(contents).toContain('const require = __cjsCreateRequire(import.meta.url)');
    expect(contents).toContain('const __filename = __cjsFileUrlToPath(import.meta.url)');
  });

  it('respects additional externals and leaves them as runtime imports', async () => {
    // Add a fake import that names a package we want externalised. esbuild
    // would normally fail to resolve it; marking it external bypasses that.
    await writeFile(
      join(workDir, 'fargate-entry.ts'),
      `import sample from './sample-migration';
import * as fakeLib from 'some-runtime-only-pkg';

export const registry = { sample };
export const x = fakeLib;
`,
      'utf8',
    );
    const out = join(workDir, 'dist', 'bundle.mjs');
    await bundleMigrations({
      entryPoint: 'fargate-entry.ts',
      outFile: out,
      cwd: workDir,
      external: ['some-runtime-only-pkg'],
    });
    const contents = await readFile(out, 'utf8');
    expect(contents).toContain('"some-runtime-only-pkg"');
  });

  it('creates the parent directory if missing', async () => {
    const out = join(workDir, 'a', 'b', 'c', 'bundle.mjs');
    const result = await bundleMigrations({
      entryPoint: 'fargate-entry.ts',
      outFile: out,
      cwd: workDir,
    });
    expect(result.outFile).toBe(out);
    const contents = await readFile(out, 'utf8');
    expect(contents.length).toBeGreaterThan(0);
  });

  it('exposes the default external list publicly', () => {
    expect(DEFAULT_BUNDLE_EXTERNALS).toContain('@aws-sdk/*');
    expect(DEFAULT_BUNDLE_EXTERNALS).toContain('@smithy/*');
    expect(DEFAULT_BUNDLE_EXTERNALS).toContain('@aws-crypto/*');
    // Frozen so consumers can't accidentally mutate the shared default.
    expect(Object.isFrozen(DEFAULT_BUNDLE_EXTERNALS)).toBe(true);
  });

  it('every DEFAULT_BUNDLE_EXTERNALS pattern has a matching dep in the runner image', async () => {
    // Parity contract: anything externalised by default must be installable
    // by the runner image's runner-package.json. Drift in either direction
    // causes ERR_MODULE_NOT_FOUND at runtime — this test fails CI instead
    // so the package and image stay in lock-step.
    const here = dirname(fileURLToPath(import.meta.url));
    const runnerPkgPath = resolve(here, '../../dockerfiles/runner/runner-package.json');
    const runnerPkg = JSON.parse(await readFile(runnerPkgPath, 'utf8')) as {
      dependencies: Record<string, string>;
    };
    const deps = Object.keys(runnerPkg.dependencies);

    const missing: string[] = [];
    for (const pattern of DEFAULT_BUNDLE_EXTERNALS) {
      if (!pattern.endsWith('/*')) {
        if (!deps.includes(pattern)) missing.push(pattern);
        continue;
      }
      const prefix = pattern.slice(0, -1); // strip trailing '*'
      if (!deps.some((dep) => dep.startsWith(prefix))) missing.push(pattern);
    }
    expect(missing).toEqual([]);
  });

  it('defaults to cwd when cwd is omitted', async () => {
    // Move into the work dir so process.cwd() == workDir, then bundle
    // with a relative path. On macOS process.cwd() resolves through
    // /private symlinks; compare just that the file actually got written
    // to the expected leaf path rather than against an absolute string.
    const original = process.cwd();
    try {
      process.chdir(workDir);
      await mkdir(join(workDir, 'dist'), { recursive: true });
      const result = await bundleMigrations({
        entryPoint: 'fargate-entry.ts',
        outFile: 'dist/bundle.mjs',
      });
      expect(result.outFile.endsWith('/dist/bundle.mjs')).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    } finally {
      process.chdir(original);
    }
  });
});
