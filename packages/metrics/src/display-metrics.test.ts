import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { displayMetrics } from './display-metrics';
import { getMetrics, recordMetrics, resetMetrics } from './metrics';

describe('displayMetrics', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    resetMetrics();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should display a message when no metrics are recorded', () => {
    displayMetrics();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No metrics recorded yet'));
  });

  it('should display metrics summary and tree for recorded metrics', () => {
    // Record some test metrics
    recordMetrics('api.users.get', 100);
    recordMetrics('api.users.create', 150);
    recordMetrics('api.posts.get', 80);
    recordMetrics('api.posts.create', 120);
    recordMetrics('database.query', 50);

    displayMetrics();

    // Verify console.log was called multiple times
    expect(consoleSpy).toHaveBeenCalled();

    // Verify output contains summary table
    const allCalls = consoleSpy.mock.calls.map((call) => call.join(' '));
    const output = allCalls.join('\n');

    expect(output).toContain('Metrics Summary');
    expect(output).toContain('Metrics Tree');
  });

  it('should display error information when errors are present', () => {
    const error = new Error('Test error');
    recordMetrics('api.users.get', 100, error);

    displayMetrics();

    const allCalls = consoleSpy.mock.calls.map((call) => call.join(' '));
    const output = allCalls.join('\n');

    expect(output).toContain('Errors');
    expect(output).toContain('1'); // Should show 1 error
  });

  it('should display hierarchical structure correctly', () => {
    // Record metrics with different levels
    recordMetrics('level1.level2.level3.operation1', 100);
    recordMetrics('level1.level2.level3.operation2', 150);
    recordMetrics('level1.level2.operation3', 80);

    displayMetrics();

    const allCalls = consoleSpy.mock.calls.map((call) => call.join(' '));
    const output = allCalls.join('\n');

    // Should contain hierarchical tree structure
    expect(output).toContain('Metrics');
    expect(output).toContain('level1');
    expect(output).toContain('level2');
    expect(output).toContain('level3');
  });

  it('should calculate and display statistics correctly', () => {
    // Record multiple calls to the same metric
    recordMetrics('api.test', 100);
    recordMetrics('api.test', 200);
    recordMetrics('api.test', 150);

    displayMetrics();

    const allCalls = consoleSpy.mock.calls.map((call) => call.join(' '));
    const output = allCalls.join('\n');

    // Should display call count header
    expect(output).toContain('Calls');

    // Verify the metrics were recorded correctly
    const metrics = getMetrics();
    expect(metrics['api.test'].totalRecords).toBe(3);
    expect(metrics['api.test'].averageDuration).toBe(150);
  });
});
