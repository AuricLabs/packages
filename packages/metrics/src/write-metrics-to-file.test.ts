import { readFile, unlink } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { recordMetrics, resetMetrics } from './metrics';
import { writeMetricsToFile } from './write-metrics-to-file';

describe('writeMetricsToFile', () => {
  const testFilePath = './test-metrics.csv';

  beforeEach(() => {
    resetMetrics();
  });

  afterEach(async () => {
    // Clean up test file if it exists
    try {
      await unlink(testFilePath);
    } catch {
      // File might not exist, that's ok
    }
  });

  it('should write metrics to a CSV file', async () => {
    // Record some sample metrics
    recordMetrics('api.getUser', 100);
    recordMetrics('api.getUser', 150);
    recordMetrics('api.updateUser', 200);
    recordMetrics('db.query', 50, new Error('Database error'));

    // Write to file
    await writeMetricsToFile(testFilePath);

    // Read the file and verify contents
    const content = await readFile(testFilePath, 'utf-8');
    const lines = content.split('\n');

    // Check header
    expect(lines[0]).toBe(
      'Span,Total Calls,Average Duration (ms),Min Duration (ms),Max Duration (ms),Total Duration (ms),Total Errors',
    );

    // Check that we have the right number of lines (header + 3 records)
    expect(lines.length).toBe(4);

    // Check content includes our metrics (sorted alphabetically)
    expect(lines[1]).toContain('"api.getUser"');
    expect(lines[1]).toContain('2'); // 2 calls
    expect(lines[1]).toContain('125.00'); // average duration
    expect(lines[1]).toContain('100.00'); // min duration
    expect(lines[1]).toContain('150.00'); // max duration
    expect(lines[1]).toContain('250.00'); // total duration
    expect(lines[1]).toContain('0'); // no errors

    expect(lines[2]).toContain('"api.updateUser"');
    expect(lines[2]).toContain('1'); // 1 call
    expect(lines[2]).toContain('200.00'); // duration

    expect(lines[3]).toContain('"db.query"');
    expect(lines[3]).toContain('1'); // 1 error
  });

  it('should handle metrics with special characters in span names', async () => {
    recordMetrics('api.users."John Doe"', 100);
    recordMetrics('metrics,with,commas', 200);

    await writeMetricsToFile(testFilePath);

    const content = await readFile(testFilePath, 'utf-8');
    // In CSV format, quotes are escaped by doubling them
    expect(content).toContain('"api.users.""John Doe"""');
    expect(content).toContain('"metrics,with,commas"');
  });

  it('should throw an error when no metrics are recorded', async () => {
    await expect(writeMetricsToFile(testFilePath)).rejects.toThrow(
      'No metrics to write. Record some metrics first.',
    );
  });

  it('should format numbers with 2 decimal places', async () => {
    recordMetrics('test.function', 123.456789);
    recordMetrics('test.function', 234.567891);

    await writeMetricsToFile(testFilePath);

    const content = await readFile(testFilePath, 'utf-8');
    const lines = content.split('\n');

    // Check that numbers are formatted to 2 decimal places
    expect(lines[1]).toContain('179.01'); // average (358.024680 / 2)
    expect(lines[1]).toContain('123.46'); // min
    expect(lines[1]).toContain('234.57'); // max
    expect(lines[1]).toContain('358.02'); // total
  });

  it('should handle min duration of Infinity', async () => {
    // This shouldn't happen normally, but test edge case
    recordMetrics('test.edge', 100);

    await writeMetricsToFile(testFilePath);

    const content = await readFile(testFilePath, 'utf-8');
    expect(content).toContain('100.00'); // min should be 100
  });

  it('should sort spans alphabetically', async () => {
    recordMetrics('zebra', 100);
    recordMetrics('apple', 100);
    recordMetrics('middle', 100);

    await writeMetricsToFile(testFilePath);

    const content = await readFile(testFilePath, 'utf-8');
    const lines = content.split('\n');

    // Check order: header, apple, middle, zebra
    expect(lines[1]).toContain('"apple"');
    expect(lines[2]).toContain('"middle"');
    expect(lines[3]).toContain('"zebra"');
  });

  it('should handle multiple errors correctly', async () => {
    recordMetrics('failing.function', 100, new Error('Error 1'));
    recordMetrics('failing.function', 150, new Error('Error 2'));
    recordMetrics('failing.function', 200); // Success

    await writeMetricsToFile(testFilePath);

    const content = await readFile(testFilePath, 'utf-8');
    const lines = content.split('\n');

    // Should show 2 errors out of 3 calls
    expect(lines[1]).toContain('3'); // 3 total calls
    expect(lines[1]).toContain('2'); // 2 errors (at the end)
  });
});
