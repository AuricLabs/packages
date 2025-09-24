import { describe, it, expect, jest } from '@jest/globals';

import { cacheFunction } from './cache-function';
import { defaultCache } from './default-cache';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('cacheFunction', () => {
  it('caches function calls with same arguments', async () => {
    const fn = jest.fn((arg: string) => `result-${arg}`);
    const cachedFn = cacheFunction(fn);

    const result1 = await cachedFn('test');
    expect(result1).toBe('result-test');
    expect(fn).toHaveBeenCalledTimes(1);

    const result2 = await cachedFn('test');
    expect(result2).toBe('result-test');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls function for different arguments', async () => {
    const fn = jest.fn((arg: string) => `result-${arg}`);
    const cachedFn = cacheFunction(fn);

    await cachedFn('test1');
    expect(fn).toHaveBeenCalledTimes(1);

    await cachedFn('test2');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('handles inflight requests', async () => {
    const fn = jest.fn((arg: string) => sleep(50).then(() => `result-${arg}`));
    const cachedFn = cacheFunction(fn);

    const [result1, result2] = await Promise.all([cachedFn('test'), cachedFn('test')]);

    expect(result1).toBe('result-test');
    expect(result2).toBe('result-test');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects ttl', async () => {
    const fn = jest.fn((arg: string) => `result-${arg}`);
    const cachedFn = cacheFunction(fn, { ttl: 100 });

    await cachedFn('test');
    expect(fn).toHaveBeenCalledTimes(1);

    await cachedFn('test');
    expect(fn).toHaveBeenCalledTimes(1);

    await sleep(150);

    await cachedFn('test');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('clears specific cache entry', async () => {
    const fn = jest.fn((arg: string) => `result-${arg}`);
    const cachedFn = cacheFunction(fn);

    await cachedFn('test');
    expect(fn).toHaveBeenCalledTimes(1);

    const clearResult = await cachedFn.clear('test');
    expect(clearResult).toBe(true);

    await cachedFn('test');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('clears all cache entries', async () => {
    const fn = jest.fn((arg: string) => `result-${arg}`);
    const cachedFn = cacheFunction(fn);

    await cachedFn('test1');
    await cachedFn('test2');
    expect(fn).toHaveBeenCalledTimes(2);

    await cachedFn.clearAll();

    await cachedFn('test1');
    await cachedFn('test2');
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('clear returns false for non-existent key', async () => {
    const fn = jest.fn((arg: string) => `result-${arg}`);
    const cachedFn = cacheFunction(fn);

    const clearResult = await cachedFn.clear('nonexistent');
    expect(clearResult).toBe(false);
  });

  it('clear works with different argument types', async () => {
    const fn = jest.fn((obj: { id: number }) => `result-${String(obj.id)}`);
    const cachedFn = cacheFunction(fn);

    await cachedFn({ id: 1 });
    expect(fn).toHaveBeenCalledTimes(1);

    const clearResult = await cachedFn.clear({ id: 1 });
    expect(clearResult).toBe(true);

    await cachedFn({ id: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('clear method uses serializeArgs for key generation', async () => {
    const fn = jest.fn((obj: { id: number }) => `result-${String(obj.id)}`);
    const serializeArgs = jest.fn((args: [{ id: number }]) => `custom-${String(args[0].id)}`);
    const cachedFn = cacheFunction(fn, { serializeArgs });

    await cachedFn({ id: 1 });
    expect(fn).toHaveBeenCalledTimes(1);

    const clearResult = await cachedFn.clear({ id: 1 });
    expect(clearResult).toBe(true);
    expect(serializeArgs).toHaveBeenCalledWith([{ id: 1 }]);

    await cachedFn({ id: 1 });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('clearAll method clears entire store', async () => {
    const fn = jest.fn((arg: string) => `result-${arg}`);
    const cachedFn = cacheFunction(fn);

    await cachedFn('test1');
    await cachedFn('test2');
    await cachedFn('test3');
    expect(fn).toHaveBeenCalledTimes(3);

    await cachedFn.clearAll();

    await cachedFn('test1');
    await cachedFn('test2');
    await cachedFn('test3');
    expect(fn).toHaveBeenCalledTimes(6);
  });

  it('works with custom args serializer', async () => {
    const fn = jest.fn((obj: { key: string }) => `result-${obj.key}`);
    const serializeArgs = (args: [{ key: string }]) => args[0].key.toUpperCase();
    const cachedFn = cacheFunction(fn, { serializeArgs });

    await cachedFn({ key: 'test' });
    expect(fn).toHaveBeenCalledTimes(1);

    await cachedFn({ key: 'TEST' }); // same after upper case
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('works with synchronous functions', async () => {
    const fn = jest.fn((arg: string) => `sync-result-${arg}`);
    const cachedFn = cacheFunction(fn);

    const result1 = await cachedFn('test');
    expect(result1).toBe('sync-result-test');
    expect(fn).toHaveBeenCalledTimes(1);

    const result2 = await cachedFn('test');
    expect(result2).toBe('sync-result-test');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should support having multiple cache functions with the same name', async () => {
    const fn = jest.fn((arg: string) => `sync-result-${arg}`);
    const cachedFn = cacheFunction(fn);
    const cachedFn2 = cacheFunction(fn);

    const result1 = await cachedFn('test');
    await cachedFn('test');
    await cachedFn('test');
    expect(result1).toBe('sync-result-test');
    expect(fn).toHaveBeenCalledTimes(1);

    const result2 = await cachedFn2('test');
    await cachedFn2('test');
    await cachedFn2('test');
    expect(result2).toBe('sync-result-test');
    expect(fn).toHaveBeenCalledTimes(2);

    await expect(cachedFn('test2')).resolves.toBe('sync-result-test2');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should apply the namespace as a key prefix', async () => {
    const testFunction = jest.fn((arg: string) => `sync-result-${arg}`);
    const cachedFn = cacheFunction(testFunction);

    const args = ['test'] as const;
    const result1 = await cachedFn(...args);
    expect(result1).toBe('sync-result-test');
    expect(testFunction).toHaveBeenCalledTimes(1);

    await expect(
      defaultCache.has(`${cachedFn.id}[${testFunction.name}]:${JSON.stringify(args)}`),
    ).resolves.toBe(true);
  });

  describe('set method', () => {
    it('manually sets cache value', async () => {
      const fn = jest.fn((arg: string) => `result-${arg}`);
      const cachedFn = cacheFunction(fn);

      // Set a value manually
      const setValue = await cachedFn.set('test', 'manual-value');
      expect(setValue).toBe('manual-value');

      // Call the function - should return cached value, not call original function
      const result = await cachedFn('test');
      expect(result).toBe('manual-value');
      expect(fn).not.toHaveBeenCalled();
    });

    it('set method respects TTL', async () => {
      const fn = jest.fn((arg: string) => `result-${arg}`);
      const cachedFn = cacheFunction(fn, { ttl: 100 });

      // Set a value manually
      await cachedFn.set('test', 'manual-value');

      // Should return cached value immediately
      const result1 = await cachedFn('test');
      expect(result1).toBe('manual-value');
      expect(fn).not.toHaveBeenCalled();

      // Wait for TTL to expire
      await sleep(150);

      // Should call original function after TTL expires
      const result2 = await cachedFn('test');
      expect(result2).toBe('result-test');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('set method works with different argument types', async () => {
      const fn = jest.fn((obj: { id: number }) => `result-${String(obj.id)}`);
      const cachedFn = cacheFunction(fn);

      // Set a value manually
      const setValue = await cachedFn.set({ id: 1 }, 'manual-result');
      expect(setValue).toBe('manual-result');

      // Call the function - should return cached value
      const result = await cachedFn({ id: 1 });
      expect(result).toBe('manual-result');
      expect(fn).not.toHaveBeenCalled();
    });

    it('set method uses serializeArgs for key generation', async () => {
      const fn = jest.fn((obj: { id: number }) => `result-${String(obj.id)}`);
      const serializeArgs = jest.fn((args: [{ id: number }]) => `custom-${String(args[0].id)}`);
      const cachedFn = cacheFunction(fn, { serializeArgs });

      // Set a value manually
      await cachedFn.set({ id: 1 }, 'manual-result');
      expect(serializeArgs).toHaveBeenCalledWith([{ id: 1 }]);

      // Call the function - should return cached value
      const result = await cachedFn({ id: 1 });
      expect(result).toBe('manual-result');
      expect(fn).not.toHaveBeenCalled();
    });

    it('set method throws error when no value provided', async () => {
      const fn = jest.fn((arg: string) => `result-${arg}`);
      const cachedFn = cacheFunction(fn);
      // @ts-expect-error - Testing error case with missing value parameter
      await expect(cachedFn.set()).rejects.toThrow('Value is required');
    });

    it('set method works with synchronous return values', async () => {
      const fn = jest.fn((arg: string) => `sync-result-${arg}`);
      const cachedFn = cacheFunction(fn);

      // Set a synchronous value manually
      const setValue = await cachedFn.set('test', 'manual-sync-value');
      expect(setValue).toBe('manual-sync-value');

      // Call the function - should return cached value
      const result = await cachedFn('test');
      expect(result).toBe('manual-sync-value');
      expect(fn).not.toHaveBeenCalled();
    });

    it('set method overwrites existing cached values', async () => {
      const fn = jest.fn((arg: string) => `result-${arg}`);
      const cachedFn = cacheFunction(fn);

      // First call to cache the original result
      const originalResult = await cachedFn('test');
      expect(originalResult).toBe('result-test');
      expect(fn).toHaveBeenCalledTimes(1);

      // Set a new value manually
      await cachedFn.set('test', 'overwritten-value');

      // Call the function - should return the overwritten value
      const result = await cachedFn('test');
      expect(result).toBe('overwritten-value');
      expect(fn).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('set method works with multiple arguments', async () => {
      const fn = jest.fn((a: string, b: number) => `result-${a}-${String(b)}`);
      const cachedFn = cacheFunction(fn);

      // Set a value manually with multiple arguments
      const setValue = await cachedFn.set('test', 42, 'manual-multi-value');
      expect(setValue).toBe('manual-multi-value');

      // Call the function - should return cached value
      const result = await cachedFn('test', 42);
      expect(result).toBe('manual-multi-value');
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
