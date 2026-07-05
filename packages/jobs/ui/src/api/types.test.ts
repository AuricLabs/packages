import { describe, expect, it } from 'vitest';

import { JOB_STATUSES, getStatusDisplay } from './types';

describe('getStatusDisplay', () => {
  it('returns a label and className for every job status', () => {
    for (const status of JOB_STATUSES) {
      const display = getStatusDisplay(status);
      expect(display.label.length).toBeGreaterThan(0);
      expect(display.className.length).toBeGreaterThan(0);
    }
  });

  it('maps statuses to their expected labels', () => {
    expect(getStatusDisplay('pending').label).toBe('Pending');
    expect(getStatusDisplay('running').label).toBe('Running');
    expect(getStatusDisplay('completed').label).toBe('Completed');
    expect(getStatusDisplay('failed').label).toBe('Failed');
    expect(getStatusDisplay('cancelled').label).toBe('Cancelled');
  });
});
