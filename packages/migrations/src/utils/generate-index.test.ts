import fs from 'fs';
import os from 'os';
import path from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { generateMigrationIndex } from './generate-index';

describe('generateMigrationIndex', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('throws if directory does not exist', () => {
    expect(() => generateMigrationIndex('/nonexistent/path')).toThrow(
      'Migrations directory does not exist',
    );
  });

  it('generates an empty index for a directory with no migration files', () => {
    const indexPath = generateMigrationIndex(tmpDir);
    const content = fs.readFileSync(indexPath, 'utf-8');

    expect(content).toContain('defineMigrations');
    expect(content).toContain('export const migrations = defineMigrations({');
    expect(content).toContain('});');
  });

  it('generates imports and entries for migration files', () => {
    fs.writeFileSync(path.join(tmpDir, '20250601120000_add-users.ts'), '');
    fs.writeFileSync(path.join(tmpDir, '20250602120000_add-roles.ts'), '');

    const indexPath = generateMigrationIndex(tmpDir);
    const content = fs.readFileSync(indexPath, 'utf-8');

    expect(content).toContain("import addUsers from './20250601120000_add-users';");
    expect(content).toContain("import addRoles from './20250602120000_add-roles';");
    expect(content).toContain("'20250601120000_add-users': addUsers,");
    expect(content).toContain("'20250602120000_add-roles': addRoles,");
  });

  it('ignores non-migration files', () => {
    fs.writeFileSync(path.join(tmpDir, '20250601120000_add-users.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'index.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '');

    const indexPath = generateMigrationIndex(tmpDir);
    const content = fs.readFileSync(indexPath, 'utf-8');

    expect(content).toContain('addUsers');
    expect(content).not.toContain('README');
  });

  it('handles duplicate identifier names with suffix', () => {
    fs.writeFileSync(path.join(tmpDir, '20250601120000_add-users.ts'), '');
    fs.writeFileSync(path.join(tmpDir, '20250602120000_add-users.ts'), '');

    const indexPath = generateMigrationIndex(tmpDir);
    const content = fs.readFileSync(indexPath, 'utf-8');

    expect(content).toContain('import addUsers from');
    expect(content).toContain('import addUsers2 from');
  });

  it('sorts migration files by name', () => {
    fs.writeFileSync(path.join(tmpDir, '20250602120000_second.ts'), '');
    fs.writeFileSync(path.join(tmpDir, '20250601120000_first.ts'), '');

    const indexPath = generateMigrationIndex(tmpDir);
    const content = fs.readFileSync(indexPath, 'utf-8');

    const firstIndex = content.indexOf('first');
    const secondIndex = content.indexOf('second');
    expect(firstIndex).toBeLessThan(secondIndex);
  });

  it('returns the path to the generated index file', () => {
    const indexPath = generateMigrationIndex(tmpDir);
    expect(indexPath).toBe(path.join(tmpDir, 'index.ts'));
    expect(fs.existsSync(indexPath)).toBe(true);
  });

  it('includes auto-generated header comment', () => {
    const indexPath = generateMigrationIndex(tmpDir);
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain('auto-generated');
  });

  it('supports .js migration files', () => {
    fs.writeFileSync(path.join(tmpDir, '20250601120000_add-users.js'), '');

    const indexPath = generateMigrationIndex(tmpDir);
    const content = fs.readFileSync(indexPath, 'utf-8');

    expect(content).toContain("import addUsers from './20250601120000_add-users';");
    expect(content).toContain("'20250601120000_add-users': addUsers,");
  });

  it('handles mixed .ts and .js files', () => {
    fs.writeFileSync(path.join(tmpDir, '20250601120000_add-users.ts'), '');
    fs.writeFileSync(path.join(tmpDir, '20250602120000_add-roles.js'), '');

    const indexPath = generateMigrationIndex(tmpDir);
    const content = fs.readFileSync(indexPath, 'utf-8');

    expect(content).toContain('addUsers');
    expect(content).toContain('addRoles');
  });
});
