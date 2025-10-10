import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getMetrics, resetMetrics } from './metrics';
import { span } from './span';

describe('span', () => {
  beforeEach(() => {
    // Clear metrics before each test
    resetMetrics();
  });

  it('should record metrics for a successful async function', async () => {
    await span('test', async () => {
      await span('operation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    });

    const metrics = getMetrics();
    expect(metrics['test.operation']).toBeDefined();
    expect(metrics['test.operation'].totalRecords).toBe(1);
    expect(metrics['test.operation'].totalDuration).toBeGreaterThan(0);
    expect(metrics['test.operation'].totalErrors).toBe(0);
  });

  it('should record errors when the function throws', async () => {
    const testError = new Error('Test error');

    await span('test', async () => {
      await span('error', () => {
        throw testError;
      });
    }).catch(() => {
      // Ignore error
    });

    const metrics = getMetrics();
    expect(metrics['test.error']).toBeDefined();
    expect(metrics['test.error'].totalErrors).toBe(1);
    expect(metrics['test.error'].lastError).toBe(testError);
  });

  it('should rethrow errors', async () => {
    // This should not throw
    let errorThrown = false;
    try {
      await span('test', async () => {
        await span('noThrow', () => {
          throw new Error('Should be caught');
        });
      });
    } catch {
      errorThrown = true;
    }

    expect(errorThrown).toBe(true);
  });

  it('should measure execution time accurately', async () => {
    const delay = 50;

    await span('test', async () => {
      await span('timing', async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
      });
    });

    const metrics = getMetrics();
    const duration = metrics['test.timing'].totalDuration;

    // Duration should be at least the delay time (with some margin for execution overhead)
    expect(duration).toBeGreaterThanOrEqual(delay * 0.9);
  });

  it('should support nested spans with hierarchical names', async () => {
    await span('parent', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      await span('child1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });

      await span('child2', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
      });
    });

    const metrics = getMetrics();

    expect(metrics.parent).toBeDefined();
    expect(metrics['parent.child1']).toBeDefined();
    expect(metrics['parent.child2']).toBeDefined();
  });

  it('should call the function', async () => {
    const mockFn = vi.fn().mockResolvedValue(undefined);

    await span('test', async () => {
      await span('call', mockFn);
    });

    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple calls to the same span', async () => {
    await span('test', async () => {
      await span('multiple', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    });

    await span('test', async () => {
      await span('multiple', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    });

    await span('test', async () => {
      await span('multiple', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    });

    const metrics = getMetrics();
    expect(metrics['test.multiple'].totalRecords).toBe(3);
  });

  it('should record duration even when function throws', async () => {
    await span('test', async () => {
      await span('errorDuration', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error('Error after delay');
      });
    }).catch(() => {
      // Ignore error
    });

    const metrics = getMetrics();
    expect(metrics['test.errorDuration'].totalDuration).toBeGreaterThan(0);
  });

  describe('return values', () => {
    it('should return values from synchronous functions', () => {
      const result = span('test', () => {
        return span('sync', () => 42);
      });

      expect(result).toBe(42);

      const metrics = getMetrics();
      expect(metrics['test.sync']).toBeDefined();
      expect(metrics['test.sync'].totalRecords).toBe(1);
    });

    it('should return values from async functions', async () => {
      const result = await span('test', async () => {
        return await span('async', () => {
          return Promise.resolve('hello');
        });
      });

      expect(result).toBe('hello');

      const metrics = getMetrics();
      expect(metrics['test.async']).toBeDefined();
      expect(metrics['test.async'].totalRecords).toBe(1);
    });

    it('should return objects from functions', async () => {
      const expected = { id: 123, name: 'test' };
      const result = await span('test', async () => {
        return await span('object', () => Promise.resolve(expected));
      });

      expect(result).toEqual(expected);
      expect(result).toBe(expected);
    });

    it('should return arrays from functions', () => {
      const expected = [1, 2, 3, 4, 5];
      const result = span('test', () => {
        return span('array', () => expected);
      });

      expect(result).toEqual(expected);
      expect(result).toBe(expected);
    });

    it('should return null and undefined', async () => {
      const nullResult = await span('test', async () => {
        return await span('null', () => {
          return Promise.resolve(null);
        });
      });
      expect(nullResult).toBe(null);

      span('test', () => {
        span('undefined', () => {
          // Returns undefined implicitly
        });
        // Verify the span was recorded even for void functions
        const metrics = getMetrics();
        expect(metrics['test.undefined']).toBeDefined();
      });
    });

    it('should return values even when nested spans throw', async () => {
      const result = await span('test', async () => {
        try {
          await span('failing', () => Promise.reject(new Error('Inner error')));
        } catch {
          // Catch inner error
        }

        return await span('success', () => Promise.resolve('recovered'));
      });

      expect(result).toBe('recovered');

      const metrics = getMetrics();
      expect(metrics['test.failing'].totalErrors).toBe(1);
      expect(metrics['test.success'].totalErrors).toBe(0);
    });

    it('should handle mixed sync and async nested spans', async () => {
      const result = await span('test', async () => {
        const syncValue = span('sync', () => 10);
        const asyncValue = await span('async', () => Promise.resolve(20));
        return span('compute', () => syncValue + asyncValue);
      });

      expect(result).toBe(30);

      const metrics = getMetrics();
      expect(metrics['test.sync']).toBeDefined();
      expect(metrics['test.async']).toBeDefined();
      expect(metrics['test.compute']).toBeDefined();
    });

    it('should return complex objects with methods', () => {
      class TestClass {
        constructor(public value: number) {}
        getValue() {
          return this.value;
        }
      }

      const result = span('test', () => {
        return span('class', () => new TestClass(42));
      });

      expect(result).toBeInstanceOf(TestClass);
      expect(result.getValue()).toBe(42);
    });
  });
});
