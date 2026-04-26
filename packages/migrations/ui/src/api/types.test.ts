import { describe, it, expect } from 'vitest';
import { getDisplayStatus } from './types';
import type { MigrationStatus, MigrationDirection } from './types';

describe('getDisplayStatus', () => {
  describe('up direction', () => {
    const direction: MigrationDirection = 'up';

    it('returns "pending" for pending status', () => {
      expect(getDisplayStatus('pending', direction)).toBe('pending');
    });

    it('returns "running" for running status', () => {
      expect(getDisplayStatus('running', direction)).toBe('running');
    });

    it('returns "migrated" for completed status', () => {
      expect(getDisplayStatus('completed', direction)).toBe('migrated');
    });

    it('returns "failed" for failed status', () => {
      expect(getDisplayStatus('failed', direction)).toBe('failed');
    });

    it('returns "failed" for rolling_back status', () => {
      expect(getDisplayStatus('rolling_back', direction)).toBe('failed');
    });

    it('returns "failed" for rolled_back status', () => {
      expect(getDisplayStatus('rolled_back', direction)).toBe('failed');
    });
  });

  describe('down direction', () => {
    const direction: MigrationDirection = 'down';

    it('returns "pending" for pending status', () => {
      expect(getDisplayStatus('pending', direction)).toBe('pending');
    });

    it('returns "reverting" for running status', () => {
      expect(getDisplayStatus('running', direction)).toBe('reverting');
    });

    it('returns "reverted" for completed status', () => {
      expect(getDisplayStatus('completed', direction)).toBe('reverted');
    });

    it('returns "revert_failed" for failed status', () => {
      expect(getDisplayStatus('failed', direction)).toBe('revert_failed');
    });

    it('returns "reverting" for rolling_back status', () => {
      expect(getDisplayStatus('rolling_back', direction)).toBe('reverting');
    });

    it('returns "reverted" for rolled_back status', () => {
      expect(getDisplayStatus('rolled_back', direction)).toBe('reverted');
    });
  });

  describe('exhaustive coverage', () => {
    const allStatuses: MigrationStatus[] = [
      'pending',
      'running',
      'completed',
      'failed',
      'rolling_back',
      'rolled_back',
    ];
    const allDirections: MigrationDirection[] = ['up', 'down'];

    it('returns a valid DisplayStatus for every status/direction combination', () => {
      const validDisplayStatuses = [
        'pending',
        'migrated',
        'running',
        'failed',
        'reverted',
        'reverting',
        'revert_failed',
      ];

      for (const status of allStatuses) {
        for (const direction of allDirections) {
          const result = getDisplayStatus(status, direction);
          expect(validDisplayStatuses).toContain(result);
        }
      }
    });
  });
});
