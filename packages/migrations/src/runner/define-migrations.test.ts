import { describe, it, expect } from 'vitest';

import { defineMigrations } from './define-migrations';

import type { Migration } from '../types';

function makeMigration(name: string): Migration {
  return {
    name,
    up: async () => {},
    down: async () => {},
  };
}

describe('defineMigrations', () => {
  it('returns an empty array for empty input', () => {
    const result = defineMigrations({});
    expect(result).toEqual([]);
  });

  it('returns entries with id and migration', () => {
    const migration = makeMigration('add-users');
    const result = defineMigrations({
      '20250601120000_add-users': migration,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('20250601120000_add-users');
    expect(result[0].migration).toBe(migration);
  });

  it('sorts entries by id', () => {
    const result = defineMigrations({
      '20250603120000_third': makeMigration('third'),
      '20250601120000_first': makeMigration('first'),
      '20250602120000_second': makeMigration('second'),
    });

    expect(result.map((e) => e.id)).toEqual([
      '20250601120000_first',
      '20250602120000_second',
      '20250603120000_third',
    ]);
  });

  it('preserves migration references', () => {
    const first = makeMigration('first');
    const second = makeMigration('second');

    const result = defineMigrations({
      '20250601120000_first': first,
      '20250602120000_second': second,
    });

    expect(result[0].migration).toBe(first);
    expect(result[1].migration).toBe(second);
  });
});
