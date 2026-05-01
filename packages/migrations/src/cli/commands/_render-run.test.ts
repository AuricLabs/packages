import { describe, expect, it } from 'vitest';

import { renderRunDetail } from './_render-run';

import type { MigrationRecord } from '../../types';

function record(overrides: Partial<MigrationRecord> = {}): MigrationRecord {
  return {
    id: 'mig-1',
    name: 'mig-1',
    status: 'completed',
    direction: 'up',
    startedAt: 1000,
    completedAt: 2000,
    duration: 1000,
    executionId: 'exec-1',
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

describe('renderRunDetail', () => {
  it('renders empty placeholder when no detail content', () => {
    expect(renderRunDetail(record())).toContain('no description, result, or captured output');
  });

  it('includes the description when set', () => {
    const out = renderRunDetail(record({ description: '## Heading\n\nbody' }));
    expect(out).toContain('Description:');
    expect(out).toContain('## Heading');
  });

  it('includes the error when failed', () => {
    const out = renderRunDetail(record({ status: 'failed', error: 'boom' }));
    expect(out).toContain('Error:');
    expect(out).toContain('boom');
  });

  it('renders metadata as JSON under Result', () => {
    const out = renderRunDetail(record({ metadata: { rowsAffected: 42 } }));
    expect(out).toContain('Result:');
    expect(out).toContain('"rowsAffected": 42');
  });

  it('omits Result section when metadata is empty', () => {
    const out = renderRunDetail(record({ metadata: {} }));
    expect(out).not.toContain('Result:');
  });

  it('includes the output and shows a banner when truncated', () => {
    const out = renderRunDetail(
      record({ output: '[2026-05-01] [info] hi', outputTruncated: true }),
    );
    expect(out).toContain('Output:');
    expect(out).toContain('[2026-05-01] [info] hi');
    expect(out).toContain('exceeded the storage cap');
  });

  it('omits the truncation banner when not truncated', () => {
    const out = renderRunDetail(record({ output: 'all good' }));
    expect(out).toContain('Output:');
    expect(out).not.toContain('exceeded the storage cap');
  });

  it('orders sections: description, error, result, output', () => {
    const out = renderRunDetail(
      record({
        description: 'desc',
        error: 'err',
        metadata: { x: 1 },
        output: 'out',
        status: 'failed',
      }),
    );
    const descIdx = out.indexOf('Description:');
    const errIdx = out.indexOf('Error:');
    const resIdx = out.indexOf('Result:');
    const outIdx = out.indexOf('Output:');
    expect(descIdx).toBeGreaterThanOrEqual(0);
    expect(descIdx).toBeLessThan(errIdx);
    expect(errIdx).toBeLessThan(resIdx);
    expect(resIdx).toBeLessThan(outIdx);
  });
});
