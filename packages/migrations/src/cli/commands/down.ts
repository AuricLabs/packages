import path from 'path';

import { Command } from 'commander';

import { MigrationRunner } from '../../runner';

import type { MigrationRunnerConfig } from '../../types';

export const downCommand = new Command('down')
  .description('Rollback migrations')
  .option('--to <name>', 'Rollback to and including this migration')
  .option('-c, --config <path>', 'Path to migration config file', './migrate.config.ts')
  .action(async (options: { to?: string; config: string }) => {
    const configPath = path.resolve(options.config);
    const mod = (await import(configPath)) as {
      default: MigrationRunnerConfig;
    };
    const config = mod.default;

    const runner = new MigrationRunner(config);
    const result = await runner.down(options.to);

    // eslint-disable-next-line no-console
    console.log(`Status: ${result.status}`);
    // eslint-disable-next-line no-console
    console.log(`Migrations rolled back: ${result.migrationsRun.join(', ') || 'none'}`);

    if (result.migrationsRemaining.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`Migrations remaining: ${result.migrationsRemaining.join(', ')}`);
    }

    if (result.error) {
      console.error(`Error: ${result.error}`);
      throw new Error(result.error);
    }
  });
