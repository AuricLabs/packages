import { Command } from 'commander';

import { generateMigrationIndex } from '../../utils';

export const generateCommand = new Command('generate')
  .description('Generate or regenerate the migrations index file')
  .option('-d, --dir <directory>', 'Migrations directory', './migrations')
  .action((options: { dir: string }) => {
    const indexPath = generateMigrationIndex(options.dir);
    // eslint-disable-next-line no-console
    console.log(`Generated migrations index: ${indexPath}`);
  });
