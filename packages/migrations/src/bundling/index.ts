import { createHash } from 'node:crypto';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { build, type BuildOptions } from 'esbuild';

export interface BundleMigrationsOptions {
  /**
   * Entry file — typically a thin wrapper that imports
   * `runMigrationsInFargateAsCli` and the consumer's static migrations
   * registry, e.g. `migrations/fargate-entry.ts`.
   */
  entryPoint: string;
  /** Output `.mjs` path. Parent dirs are created if missing. */
  outFile: string;
  /**
   * Workspace root for resolving cross-package imports (esbuild's
   * `absWorkingDir`). Defaults to `process.cwd()`. Set this to your repo
   * root when bundling from a script that doesn't already run there.
   */
  cwd?: string;
  /**
   * Additional packages to mark external. The defaults already cover
   * AWS SDK + smithy + crypto (matching `auriclabs/migrations-runner`'s
   * pre-installed packages). Append packages here only if your runtime
   * image (or whoever runs the bundle) provides additional ones at
   * runtime that you don't want bundled inline.
   */
  external?: string[];
  /**
   * Override esbuild config. Use sparingly — the defaults are tuned to
   * match the published `migrations-runner` image's expectations.
   */
  esbuildOptions?: Partial<BuildOptions>;
}

export interface BundleResult {
  /** Absolute path of the output bundle. */
  outFile: string;
  /** Bundle size in bytes. */
  size: number;
  /** Hex SHA256 of the bundle. Pass to the runner image as `MIGRATION_BUNDLE_SHA256` for integrity verification. */
  sha256: string;
}

/**
 * Default external packages — must stay in sync with the
 * `auriclabs/migrations-runner` image's `runner-package.json`. Anything
 * matching these patterns is left as a runtime `import`/`require` rather
 * than inlined into the bundle. The runner image installs them so Node's
 * resolver finds them at runtime.
 */
export const DEFAULT_BUNDLE_EXTERNALS: readonly string[] = Object.freeze([
  '@aws-sdk/*',
  '@smithy/*',
  '@aws-crypto/*',
]);

const BANNER_JS = [
  // CommonJS interop shims — some npm packages reach into `require`,
  // `__filename`, or `__dirname` even when consumed from ESM. Inject the
  // standard shims so they load cleanly inside this ESM bundle.
  "import { createRequire as __cjsCreateRequire } from 'node:module';",
  "import { fileURLToPath as __cjsFileUrlToPath } from 'node:url';",
  "import { dirname as __cjsDirname } from 'node:path';",
  'const require = __cjsCreateRequire(import.meta.url);',
  'const __filename = __cjsFileUrlToPath(import.meta.url);',
  'const __dirname = __cjsDirname(__filename);',
].join('\n');

/**
 * Bundle a migrations entry point into a single self-contained ESM file
 * suitable for the published `auriclabs/migrations-runner` image.
 *
 * The bundle externalises AWS SDK + transitives by default (the runner
 * image pre-installs them) and inlines everything else, including
 * workspace cross-imports.
 *
 * Returns the file path, size, and SHA256 — pass the SHA into the runner
 * image as `MIGRATION_BUNDLE_SHA256` for integrity verification.
 */
export async function bundleMigrations(opts: BundleMigrationsOptions): Promise<BundleResult> {
  const cwd = resolve(opts.cwd ?? process.cwd());
  const entryPoint = resolve(cwd, opts.entryPoint);
  const outFile = resolve(cwd, opts.outFile);

  await mkdir(dirname(outFile), { recursive: true });

  const external = [...DEFAULT_BUNDLE_EXTERNALS, ...(opts.external ?? [])];

  await build({
    entryPoints: [entryPoint],
    outfile: outFile,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    sourcemap: false,
    minify: false,
    preserveSymlinks: false,
    absWorkingDir: cwd,
    logLevel: 'info',
    external: [...external],
    banner: { js: BANNER_JS },
    ...opts.esbuildOptions,
  });

  const [stats, contents] = await Promise.all([stat(outFile), readFile(outFile)]);
  const sha256 = createHash('sha256').update(contents).digest('hex');

  return {
    outFile,
    size: stats.size,
    sha256,
  };
}
