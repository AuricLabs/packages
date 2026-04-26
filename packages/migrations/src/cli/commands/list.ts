import path from 'path';

import { Command } from 'commander';

import { loadMigrations } from '../../runner';

/* eslint-disable no-console */

export const listCommand = new Command('list')
  .description('List migration files from disk')
  .option('-d, --dir <directory>', 'Migrations directory', './migrations')
  .action(async (options: { dir: string }) => {
    const dir = path.resolve(options.dir);
    const migrations = await loadMigrations(dir);

    if (migrations.length === 0) {
      console.log('No migration files found.');
      return;
    }

    console.log(`Found ${migrations.length} migration(s):`);
    console.log('\u2500'.repeat(50));

    for (const migration of migrations) {
      console.log(`  ${migration.id} (${migration.filePath})`);
    }
  });
