import path from 'path';

import { Command } from 'commander';

import { MigrationRunner } from '../../runner';

import type { MigrationRunnerConfig } from '../../types';

/* eslint-disable no-console */

export const statusCommand = new Command('status')
  .description('Show migration status')
  .option('-c, --config <path>', 'Path to migration config file', './migrate.config.ts')
  .action(async (options: { config: string }) => {
    const configPath = path.resolve(options.config);
    const mod = (await import(configPath)) as {
      default: MigrationRunnerConfig;
    };
    const config = mod.default;

    const runner = new MigrationRunner(config);
    const status = await runner.status();

    console.log('Migration Status:');
    console.log('\u2500'.repeat(50));

    if (status.completed.length > 0) {
      console.log(`\nCompleted (${status.completed.length}):`);
      for (const id of status.completed) {
        console.log(`  \u2713 ${id}`);
      }
    }

    if (status.pending.length > 0) {
      console.log(`\nPending (${status.pending.length}):`);
      for (const id of status.pending) {
        console.log(`  \u25CB ${id}`);
      }
    }

    if (status.failed.length > 0) {
      console.log(`\nFailed (${status.failed.length}):`);
      for (const id of status.failed) {
        console.log(`  \u2717 ${id}`);
      }
    }

    if (
      status.completed.length === 0 &&
      status.pending.length === 0 &&
      status.failed.length === 0
    ) {
      console.log('\nNo migrations found.');
    }
  });
