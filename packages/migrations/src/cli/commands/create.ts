import fs from 'fs';
import path from 'path';

import { Command } from 'commander';

import { generateTimestamp, generateMigrationIndex } from '../../utils';

const MIGRATION_TEMPLATE = `import type { Migration } from '@auriclabs/migrations';

export default {
  name: '%NAME%',
  async up(context) {
    // TODO: implement migration
  },
  async down(context) {
    // TODO: implement rollback
  },
} satisfies Migration;
`;

export const createCommand = new Command('create')
  .description('Create a new migration file')
  .argument('<name>', 'Name of the migration (e.g., add-user-roles)')
  .option('-d, --dir <directory>', 'Migrations directory', './migrations')
  .action((name: string, options: { dir: string }) => {
    const timestamp = generateTimestamp();
    const filename = `${timestamp}_${name}.ts`;
    const dir = path.resolve(options.dir);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, filename);
    const content = MIGRATION_TEMPLATE.replace('%NAME%', name);

    fs.writeFileSync(filePath, content, 'utf-8');
    // eslint-disable-next-line no-console
    console.log(`Created migration: ${filePath}`);

    const indexPath = generateMigrationIndex(dir);
    // eslint-disable-next-line no-console
    console.log(`Updated migrations index: ${indexPath}`);
  });
