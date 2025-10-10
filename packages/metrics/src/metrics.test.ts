import { afterEach, describe, expect, it } from 'vitest';

import { getMetrics, recordMetrics, resetMetrics } from './metrics';

describe('metrics', () => {
  afterEach(() => {
    resetMetrics();
  });

  describe('recordMetrics', () => {
    it('should record a single metric', () => {
      recordMetrics('test.metric', 100);

      const metrics = getMetrics();
      expect(metrics['test.metric']).toBeDefined();
      expect(metrics['test.metric'].totalRecords).toBe(1);
      expect(metrics['test.metric'].totalDuration).toBe(100);
      expect(metrics['test.metric'].averageDuration).toBe(100);
      expect(metrics['test.metric'].maxDuration).toBe(100);
      expect(metrics['test.metric'].minDuration).toBe(100);
    });

    it('should accumulate multiple recordings for the same metric', () => {
      recordMetrics('test.accumulate', 100);
      recordMetrics('test.accumulate', 200);
      recordMetrics('test.accumulate', 150);

      const metrics = getMetrics();
      const metric = metrics['test.accumulate'];

      expect(metric.totalRecords).toBe(3);
      expect(metric.totalDuration).toBe(450);
      expect(metric.averageDuration).toBe(150);
      expect(metric.maxDuration).toBe(200);
      expect(metric.minDuration).toBe(100);
    });

    it('should calculate correct min and max durations', () => {
      recordMetrics('test.minmax', 50);
      recordMetrics('test.minmax', 300);
      recordMetrics('test.minmax', 100);
      recordMetrics('test.minmax', 25);
      recordMetrics('test.minmax', 400);

      const metrics = getMetrics();
      const metric = metrics['test.minmax'];

      expect(metric.minDuration).toBe(25);
      expect(metric.maxDuration).toBe(400);
      expect(metric.averageDuration).toBe(175);
    });

    it('should track errors correctly', () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');

      recordMetrics('test.errors', 100, error1);
      recordMetrics('test.errors', 150);
      recordMetrics('test.errors', 200, error2);

      const metrics = getMetrics();
      const metric = metrics['test.errors'];

      expect(metric.totalErrors).toBe(2);
      expect(metric.lastError).toBe(error2);
    });

    it('should not increment error count when no error is passed', () => {
      recordMetrics('test.noerrors', 100);
      recordMetrics('test.noerrors', 150);

      const metrics = getMetrics();
      const metric = metrics['test.noerrors'];

      expect(metric.totalErrors).toBe(0);
      expect(metric.lastError).toBeUndefined();
    });

    it('should handle hierarchical metric names', () => {
      recordMetrics('api.users.get', 100);
      recordMetrics('api.users.create', 150);
      recordMetrics('api.posts.list', 80);

      const metrics = getMetrics();

      expect(metrics['api.users.get']).toBeDefined();
      expect(metrics['api.users.create']).toBeDefined();
      expect(metrics['api.posts.list']).toBeDefined();
    });

    it('should preserve lastError when undefined is not explicitly passed', () => {
      const error = new Error('Preserved error');

      recordMetrics('test.preserve', 100, error);
      recordMetrics('test.preserve', 150);

      const metrics = getMetrics();
      const metric = metrics['test.preserve'];

      expect(metric.lastError).toBe(error);
      expect(metric.totalErrors).toBe(1);
    });
  });

  describe('getMetrics', () => {
    it('should return a deep clone of metrics', () => {
      recordMetrics('test.clone', 100);

      const metrics1 = getMetrics();
      const metrics2 = getMetrics();

      // Should be deep clones, not the same reference
      expect(metrics1).not.toBe(metrics2);
      expect(metrics1['test.clone']).not.toBe(metrics2['test.clone']);

      // But should have the same values
      expect(metrics1['test.clone']).toEqual(metrics2['test.clone']);
    });

    it('should return all recorded metrics', () => {
      recordMetrics('test.one', 100);
      recordMetrics('test.two', 200);
      recordMetrics('test.three', 300);

      const metrics = getMetrics();

      expect(Object.keys(metrics)).toHaveLength(3);
      expect(metrics['test.one']).toBeDefined();
      expect(metrics['test.two']).toBeDefined();
      expect(metrics['test.three']).toBeDefined();
    });
  });
});
