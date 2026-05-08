#!/usr/bin/env node

import { Command } from 'commander';

import { bundleMigrations } from '../src/bundling';

interface RawCliOpts {
  entry?: string;
  out?: string;
  cwd?: string;
  external?: string[];
}

const program = new Command();
program
  .name('auric-migrate-bundle')
  .description(
    'Bundle a migrations entry point into a single ESM file suitable for the published ' +
      '`auriclabs/migrations-runner` image. Externalises @aws-sdk/* @smithy/* @aws-crypto/* ' +
      "(the runner image's pre-installed packages) and inlines everything else.",
  )
  .requiredOption('-e, --entry <path>', 'Entry file (typically migrations/fargate-entry.ts)')
  .option(
    '-o, --out <path>',
    'Output file (default: migrations/dist/bundle.mjs)',
    'migrations/dist/bundle.mjs',
  )
  .option('--cwd <path>', 'Workspace root for resolving cross-package imports')
  .option(
    '--external <pkg>',
    'Additional package to mark external (repeatable)',
    (value: string, prev: string[] = []) => [...prev, value],
    [] as string[],
  );

program.parse(process.argv);
const opts = program.opts<RawCliOpts>();

// `commander.requiredOption` exits before this runs if `--entry` is
// missing — but TypeScript doesn't know that, and this package's eslint
// rules forbid both `!` and `as` non-null assertions. Keep the explicit
// guard to narrow the type and provide a friendlier error if commander's
// behaviour ever changes.
if (!opts.entry) {
  process.stderr.write('error: --entry is required\n');
  // eslint-disable-next-line n/no-process-exit
  process.exit(2);
}

bundleMigrations({
  entryPoint: opts.entry,
  outFile: opts.out ?? 'migrations/dist/bundle.mjs',
  cwd: opts.cwd,
  external: opts.external,
})
  .then((result) => {
    process.stderr.write(
      `\n${result.outFile}\n  size:    ${result.size.toLocaleString()} bytes\n  sha256:  ${result.sha256}\n`,
    );
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\nbundle failed: ${message}\n`);
    // eslint-disable-next-line n/no-process-exit
    process.exit(1);
  });
