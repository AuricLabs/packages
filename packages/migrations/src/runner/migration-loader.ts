import path from 'path';

import { glob } from 'glob';

import type { Migration, MigrationContext, MigrationFile } from '../types';

const MIGRATION_FILENAME_REGEX = /^(\d{14})_(.+)\.(ts|js)$/;

function parseMigrationFilename(filename: string): { timestamp: string; name: string } | null {
  const match = MIGRATION_FILENAME_REGEX.exec(filename);
  if (!match) return null;
  return { timestamp: match[1], name: match[2] };
}

export async function loadMigrations<TContext extends MigrationContext>(
  migrationsDir: string,
): Promise<MigrationFile<TContext>[]> {
  const pattern = path.join(migrationsDir, '*.{ts,js}');
  const files = await glob(pattern);

  const migrations: MigrationFile<TContext>[] = [];

  for (const filePath of files) {
    const filename = path.basename(filePath);
    const parsed = parseMigrationFilename(filename);
    if (!parsed) continue;

    const mod = (await import(filePath)) as {
      default: Migration<TContext>;
    };
    const migration = mod.default;

    if (typeof migration.up !== 'function' || typeof migration.down !== 'function') {
      throw new Error(
        `Invalid migration file: ${filename}. Must export default { name, up, down }`,
      );
    }

    migrations.push({
      id: `${parsed.timestamp}_${parsed.name}`,
      timestamp: parsed.timestamp,
      name: parsed.name,
      filePath,
      migration,
    });
  }

  return migrations.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
