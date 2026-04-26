import type { Migration, MigrationContext, MigrationEntry } from '../types';

/**
 * Creates a sorted array of migration entries from a record of migrations.
 *
 * Use this instead of `migrationsDir` when deploying to Lambda or other bundled environments
 * where dynamic `import()` won't include migration files.
 *
 * Keys must match the migration filename stem (e.g. `20250601120000_add-user-roles`).
 * Entries are sorted by key (timestamp prefix) to ensure correct execution order.
 *
 * @example
 * ```typescript
 * import { defineMigrations } from '@auriclabs/migrations';
 * import addUserRoles from './migrations/20250601120000_add-user-roles';
 * import addPermissions from './migrations/20250602120000_add-permissions';
 *
 * const migrations = defineMigrations({
 *   '20250601120000_add-user-roles': addUserRoles,
 *   '20250602120000_add-permissions': addPermissions,
 * });
 * ```
 */
export function defineMigrations<TContext extends MigrationContext = MigrationContext>(
  migrations: Record<string, Migration<TContext>>,
): MigrationEntry<TContext>[] {
  return Object.entries(migrations)
    .map(([id, migration]) => ({ id, migration }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
