import { jest, describe, it, expect } from '@jest/globals';
import Keyv from 'keyv';

import { cacheService } from './cache-service';
import { defaultCache } from './default-cache';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('cacheService', () => {
  it('caches matching functions in the service', async () => {
    const getData = jest.fn((id: string) => `data-${id}`);
    const postData = jest.fn((id: string) => `posted-${id}`);
    const service = { getData, postData };

    const cachedService = cacheService(service);
    await cachedService.getData('1');
    expect(getData).toHaveBeenCalledTimes(1);
    await cachedService.getData('1');
    expect(getData).toHaveBeenCalledTimes(1);

    cachedService.postData('1');
    expect(postData).toHaveBeenCalledTimes(1);
    cachedService.postData('1');
    expect(postData).toHaveBeenCalledTimes(2); // not cached
  });

  it('respects custom cacheFunctionNames regex', async () => {
    const fetchData = jest.fn((id: string) => `data-${id}`);
    const service = { fetchData };

    const cachedService = cacheService(service, { cacheFunctionPrefix: 'fetch' });
    await cachedService.fetchData('1');
    expect(fetchData).toHaveBeenCalledTimes(1);
    await cachedService.fetchData('1');
    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it('handles ttl option', async () => {
    const getData = jest.fn((id: string) => `data-${id}`);
    const service = { getData };

    const cachedService = cacheService(service, { ttl: 100 });
    await cachedService.getData('1');
    expect(getData).toHaveBeenCalledTimes(1);
    await cachedService.getData('1');
    expect(getData).toHaveBeenCalledTimes(1);

    await sleep(150);

    await cachedService.getData('1');
    expect(getData).toHaveBeenCalledTimes(2);
  });

  it('handles inflight requests', async () => {
    const getData = jest.fn((id: string) => sleep(50).then(() => `data-${id}`));
    const service = { getData };

    const cachedService = cacheService(service);
    const [result1, result2] = await Promise.all([
      cachedService.getData('1'),
      cachedService.getData('1'),
    ]);

    expect(result1).toBe('data-1');
    expect(result2).toBe('data-1');
    expect(getData).toHaveBeenCalledTimes(1);
  });

  it('uses custom serializeArgs', async () => {
    const getData = jest.fn((obj: { id: string }) => `data-${obj.id}`);
    const service = { getData };

    const serializeArgs = (key: string, args: unknown[]) => {
      if (key === 'getData') {
        return (args[0] as { id: string }).id.toUpperCase();
      }
      return JSON.stringify(args);
    };

    const cachedService = cacheService(service, { serializeArgs });
    await cachedService.getData({ id: 'test' });
    expect(getData).toHaveBeenCalledTimes(1);

    await cachedService.getData({ id: 'TEST' });
    expect(getData).toHaveBeenCalledTimes(1);
  });

  it('uses provided namespace', async () => {
    const getData = jest.fn((id: string) => `data-${id}`);
    const service = { getData };

    const cachedService = cacheService(service, { namespace: 'test-namespace' });
    const args = ['1'] as const;
    await cachedService.getData(...args);
    expect(getData).toHaveBeenCalledTimes(1);

    const expectedKey = `test-namespace:${cachedService.getData.id}[${getData.name}]:${JSON.stringify(args)}`;
    await expect(defaultCache.has(expectedKey)).resolves.toBe(true);
  });

  it('does not re-wrap already cached functions', () => {
    const getData = jest.fn((id: string) => `data-${id}`);
    const service = { getData };

    const cachedService1 = cacheService(service);
    const originalCached = cachedService1.getData;
    const cachedService2 = cacheService(service);
    expect(cachedService2.getData).not.toBe(originalCached); // now returns new each time
  });

  it('works with synchronous functions', async () => {
    const getData = jest.fn((id: string) => `data-${id}`);
    const service = { getData };

    const cachedService = cacheService(service);
    const result1 = await cachedService.getData('1');
    expect(result1).toBe('data-1');
    expect(getData).toHaveBeenCalledTimes(1);

    const result2 = await cachedService.getData('1');
    expect(result2).toBe('data-1');
    expect(getData).toHaveBeenCalledTimes(1);
  });

  it('uses service name when available', async () => {
    const getData = jest.fn((id: string) => `data-${id}`);
    const service = {
      name: 'TestService',
      getData,
    };

    const cachedService = cacheService(service);
    await cachedService.getData('1');
    expect(getData).toHaveBeenCalledTimes(1);
  });

  it('uses provided namespace over service name', async () => {
    const getData = jest.fn((id: string) => `data-${id}`);
    const service = {
      name: 'TestService',
      getData,
    };

    const cachedService = cacheService(service, { namespace: 'CustomNamespace' });
    await cachedService.getData('1');
    expect(getData).toHaveBeenCalledTimes(1);
  });

  it('generates uuid when no name or namespace provided', async () => {
    const getData = jest.fn((id: string) => `data-${id}`);
    const service = { getData }; // no name property

    const cachedService = cacheService(service);
    await cachedService.getData('1');
    expect(getData).toHaveBeenCalledTimes(1);
  });

  it('handles baseStore with existing namespace', async () => {
    const getData = jest.fn((id: string) => `data-${id}`);
    const service = { getData };
    const customStore = new Keyv({ namespace: 'BaseNamespace' });

    const cachedService = cacheService(service, { store: customStore });
    await cachedService.getData('1');
    expect(getData).toHaveBeenCalledTimes(1);
  });

  describe('clearAllCache method', () => {
    it('clears all cache entries for the service', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const getUsers = jest.fn(() => ['user1', 'user2']);
      const service = { getData, getUsers };

      const cachedService = cacheService(service);

      // Cache some data
      await cachedService.getData('1');
      await cachedService.getData('2');
      await cachedService.getUsers();
      expect(getData).toHaveBeenCalledTimes(2);
      expect(getUsers).toHaveBeenCalledTimes(1);

      // Clear all cache
      await cachedService.clearAllCache();

      // All functions should be called again
      await cachedService.getData('1');
      await cachedService.getData('2');
      await cachedService.getUsers();
      expect(getData).toHaveBeenCalledTimes(4);
      expect(getUsers).toHaveBeenCalledTimes(2);
    });

    it('clearAllCache works with custom namespace', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const service = { getData };

      const cachedService = cacheService(service, { namespace: 'test-namespace' });

      // Cache some data
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(1);

      // Clear all cache
      await cachedService.clearAllCache();

      // Function should be called again
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(2);
    });

    it('clearAllCache works with custom store', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const service = { getData };
      const customStore = new Keyv();

      const cachedService = cacheService(service, { store: customStore });

      // Cache some data
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(1);

      // Clear all cache
      await cachedService.clearAllCache();

      // Function should be called again
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(2);
    });

    it('clearAllCache only affects cached functions', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const postData = jest.fn((id: string) => `posted-${id}`);
      const service = { getData, postData };

      const cachedService = cacheService(service);

      // Cache getData (prefixed with 'get')
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(1);

      // Call postData (not cached)
      cachedService.postData('1');
      expect(postData).toHaveBeenCalledTimes(1);

      // Clear all cache
      await cachedService.clearAllCache();

      // getData should be called again (was cached)
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(2);

      // postData should still only be called once (was never cached)
      cachedService.postData('1');
      expect(postData).toHaveBeenCalledTimes(2);
    });

    it('clearAllCache works with multiple cached functions', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const getUsers = jest.fn(() => ['user1', 'user2']);
      const getSettings = jest.fn(() => ({ theme: 'dark' }));
      const service = { getData, getUsers, getSettings };

      const cachedService = cacheService(service);

      // Cache multiple functions
      await cachedService.getData('1');
      await cachedService.getUsers();
      await cachedService.getSettings();
      expect(getData).toHaveBeenCalledTimes(1);
      expect(getUsers).toHaveBeenCalledTimes(1);
      expect(getSettings).toHaveBeenCalledTimes(1);

      // Clear all cache
      await cachedService.clearAllCache();

      // All functions should be called again
      await cachedService.getData('1');
      await cachedService.getUsers();
      await cachedService.getSettings();
      expect(getData).toHaveBeenCalledTimes(2);
      expect(getUsers).toHaveBeenCalledTimes(2);
      expect(getSettings).toHaveBeenCalledTimes(2);
    });

    it('clearAllCache is available on the service instance', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const service = { getData };

      const cachedService = cacheService(service);

      // Verify clearAllCache method exists
      expect(typeof cachedService.clearAllCache).toBe('function');

      // Cache some data
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(1);

      // Clear all cache using the method
      await cachedService.clearAllCache();

      // Function should be called again
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(2);
    });
  });

  describe('ignoreMethods property', () => {
    it('excludes specified methods from caching', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const getUsers = jest.fn(() => ['user1', 'user2']);
      const service = { getData, getUsers };

      const cachedService = cacheService(service, { ignoreMethods: ['getData'] });

      // getData should not be cached (ignored)
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(1);
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(2); // Called again, not cached

      // getUsers should be cached (not ignored)
      await cachedService.getUsers();
      expect(getUsers).toHaveBeenCalledTimes(1);
      await cachedService.getUsers();
      expect(getUsers).toHaveBeenCalledTimes(1); // Not called again, cached
    });

    it('excludes multiple methods from caching', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const getUsers = jest.fn(() => ['user1', 'user2']);
      const getSettings = jest.fn(() => ({ theme: 'dark' }));
      const service = { getData, getUsers, getSettings };

      const cachedService = cacheService(service, {
        ignoreMethods: ['getData', 'getUsers'],
      });

      // getData should not be cached
      await cachedService.getData('1');
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(2);

      // getUsers should not be cached
      await cachedService.getUsers();
      await cachedService.getUsers();
      expect(getUsers).toHaveBeenCalledTimes(2);

      // getSettings should be cached
      await cachedService.getSettings();
      await cachedService.getSettings();
      expect(getSettings).toHaveBeenCalledTimes(1);
    });

    it('works with custom cacheFunctionPrefix', async () => {
      const fetchData = jest.fn((id: string) => `data-${id}`);
      const fetchUsers = jest.fn(() => ['user1', 'user2']);
      const service = { fetchData, fetchUsers };

      const cachedService = cacheService(service, {
        cacheFunctionPrefix: 'fetch',
        ignoreMethods: ['fetchData'],
      });

      // fetchData should not be cached (ignored)
      await cachedService.fetchData('1');
      await cachedService.fetchData('1');
      expect(fetchData).toHaveBeenCalledTimes(2);

      // fetchUsers should be cached (not ignored)
      await cachedService.fetchUsers();
      await cachedService.fetchUsers();
      expect(fetchUsers).toHaveBeenCalledTimes(1);
    });

    it('ignores methods that match prefix but are in ignoreMethods', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const getUsers = jest.fn(() => ['user1', 'user2']);
      const getSettings = jest.fn(() => ({ theme: 'dark' }));
      const service = { getData, getUsers, getSettings };

      const cachedService = cacheService(service, {
        ignoreMethods: ['getData', 'getUsers'],
      });

      // All methods start with 'get' but some are ignored
      await cachedService.getData('1');
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(2); // Ignored

      await cachedService.getUsers();
      await cachedService.getUsers();
      expect(getUsers).toHaveBeenCalledTimes(2); // Ignored

      await cachedService.getSettings();
      await cachedService.getSettings();
      expect(getSettings).toHaveBeenCalledTimes(1); // Cached
    });

    it('handles empty ignoreMethods array', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const getUsers = jest.fn(() => ['user1', 'user2']);
      const service = { getData, getUsers };

      const cachedService = cacheService(service, { ignoreMethods: [] });

      // All methods should be cached (none ignored)
      await cachedService.getData('1');
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(1);

      await cachedService.getUsers();
      await cachedService.getUsers();
      expect(getUsers).toHaveBeenCalledTimes(1);
    });

    it('handles non-existent methods in ignoreMethods', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const service = { getData };

      const cachedService = cacheService(service, {
        // @ts-expect-error - Testing with non-existent method name
        ignoreMethods: ['nonExistentMethod', 'getData'],
      });

      // getData should not be cached (ignored)
      await cachedService.getData('1');
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(2);
    });

    it('ignores methods that are not functions', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const service = {
        getData,
        someProperty: 'not a function',
        someNumber: 42,
      };

      const cachedService = cacheService(service, {
        ignoreMethods: ['someProperty', 'someNumber'],
      });

      // getData should be cached (not ignored, and it's a function)
      await cachedService.getData('1');
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(1);

      // Properties should remain unchanged
      expect(cachedService.someProperty).toBe('not a function');
      expect(cachedService.someNumber).toBe(42);
    });

    it('ignores methods that are already cached functions', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const service = { getData };

      // First create a cached service
      const cachedService1 = cacheService(service);
      const originalCachedGetData = cachedService1.getData;

      // Then create another cached service with ignoreMethods
      const cachedService2 = cacheService(service, {
        ignoreMethods: ['getData'],
      });

      // The method should not be cached in the second service
      await cachedService2.getData('1');
      await cachedService2.getData('1');
      expect(getData).toHaveBeenCalledTimes(2);

      // Verify it's not the same cached function
      expect(cachedService2.getData).not.toBe(originalCachedGetData);
    });

    it('works with clearAllCache when methods are ignored', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const getUsers = jest.fn(() => ['user1', 'user2']);
      const service = { getData, getUsers };

      const cachedService = cacheService(service, {
        ignoreMethods: ['getData'],
      });

      // Cache getUsers (not ignored)
      await cachedService.getUsers();
      expect(getUsers).toHaveBeenCalledTimes(1);

      // Call getData (ignored, so not cached)
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(1);

      // Clear all cache
      await cachedService.clearAllCache();

      // getUsers should be called again (was cached)
      await cachedService.getUsers();
      expect(getUsers).toHaveBeenCalledTimes(2);

      // getData should still be called (was never cached)
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(2);
    });

    it('ignores methods with custom serializeArgs', async () => {
      const getData = jest.fn((obj: { id: string }) => `data-${obj.id}`);
      const getUsers = jest.fn(() => ['user1', 'user2']);
      const service = { getData, getUsers };

      const serializeArgs = jest.fn((key: string, args: unknown[]) => {
        if (key === 'getData') {
          return (args[0] as { id: string }).id.toUpperCase();
        }
        return JSON.stringify(args);
      });

      const cachedService = cacheService(service, {
        ignoreMethods: ['getData'],
        serializeArgs,
      });

      // getData should not be cached (ignored)
      await cachedService.getData({ id: 'test' });
      await cachedService.getData({ id: 'test' });
      expect(getData).toHaveBeenCalledTimes(2);
      expect(serializeArgs).not.toHaveBeenCalled(); // serializeArgs not called for ignored methods

      // getUsers should be cached (not ignored)
      await cachedService.getUsers();
      await cachedService.getUsers();
      expect(getUsers).toHaveBeenCalledTimes(1);
    });
  });

  describe('create method calling clearAllCache', () => {
    it('create method calls clearAllCache to clear existing cached data', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const getUsers = jest.fn(() => ['user1', 'user2']);
      const createUser = jest.fn(async (userData: { name: string }) => {
        // Simulate creating a user and then clearing cache
        const newUser = { id: '3', ...userData };
        // Clear all cached data when creating new user
        await cachedService.clearAllCache();
        return newUser;
      });

      const service = { getData, getUsers, createUser };
      const cachedService = cacheService(service);

      // Cache some initial data
      await cachedService.getData('1');
      await cachedService.getUsers();
      expect(getData).toHaveBeenCalledTimes(1);
      expect(getUsers).toHaveBeenCalledTimes(1);

      // Create a new user (this should clear the cache)
      const newUser = await cachedService.createUser({ name: 'user3' });
      expect(newUser).toEqual({ id: '3', name: 'user3' });
      expect(createUser).toHaveBeenCalledTimes(1);

      // Verify that cached data is cleared by calling the same functions again
      // They should be called again since cache was cleared
      await cachedService.getData('1');
      await cachedService.getUsers();
      expect(getData).toHaveBeenCalledTimes(2); // Called again due to cache clear
      expect(getUsers).toHaveBeenCalledTimes(2); // Called again due to cache clear
    });

    it('create method with custom prefix calls clearAllCache', async () => {
      const fetchData = jest.fn((id: string) => `data-${id}`);
      const createData = jest.fn(async (data: { value: string }) => {
        // Clear cache when creating new data
        await cachedService.clearAllCache();
        return { id: 'new', ...data };
      });

      const service = { fetchData, createData };
      const cachedService = cacheService(service, { cacheFunctionPrefix: 'fetch' });

      // Cache some initial data (only fetchData will be cached due to prefix)
      await cachedService.fetchData('1');
      expect(fetchData).toHaveBeenCalledTimes(1);

      // Create new data (this should clear the cache)
      const result = await cachedService.createData({ value: 'test' });
      expect(result).toEqual({ id: 'new', value: 'test' });
      expect(createData).toHaveBeenCalledTimes(1);

      // Verify that cached data is cleared
      await cachedService.fetchData('1');
      expect(fetchData).toHaveBeenCalledTimes(2); // Called again due to cache clear
    });

    it('create method calls clearAllCache with multiple cached functions', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const getUsers = jest.fn(() => ['user1', 'user2']);
      const getSettings = jest.fn(() => ({ theme: 'dark' }));
      const createUser = jest.fn(async (userData: { name: string }) => {
        // Clear all cached data when creating new user
        await cachedService.clearAllCache();
        return { id: 'new', ...userData };
      });

      const service = { getData, getUsers, getSettings, createUser };
      const cachedService = cacheService(service);

      // Cache multiple functions
      await cachedService.getData('1');
      await cachedService.getUsers();
      await cachedService.getSettings();
      expect(getData).toHaveBeenCalledTimes(1);
      expect(getUsers).toHaveBeenCalledTimes(1);
      expect(getSettings).toHaveBeenCalledTimes(1);

      // Create a new user (this should clear all cache)
      const newUser = await cachedService.createUser({ name: 'user3' });
      expect(newUser).toEqual({ id: 'new', name: 'user3' });
      expect(createUser).toHaveBeenCalledTimes(1);

      // Verify that all cached data is cleared
      await cachedService.getData('1');
      await cachedService.getUsers();
      await cachedService.getSettings();
      expect(getData).toHaveBeenCalledTimes(2); // Called again due to cache clear
      expect(getUsers).toHaveBeenCalledTimes(2); // Called again due to cache clear
      expect(getSettings).toHaveBeenCalledTimes(2); // Called again due to cache clear
    });

    it('create method calls clearAllCache with custom namespace', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const createData = jest.fn(async (data: { value: string }) => {
        // Clear cache when creating new data
        await cachedService.clearAllCache();
        return { id: 'new', ...data };
      });

      const service = { getData, createData };
      const cachedService = cacheService(service, { namespace: 'test-namespace' });

      // Cache some initial data
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(1);

      // Create new data (this should clear the cache)
      const result = await cachedService.createData({ value: 'test' });
      expect(result).toEqual({ id: 'new', value: 'test' });
      expect(createData).toHaveBeenCalledTimes(1);

      // Verify that cached data is cleared
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(2); // Called again due to cache clear
    });

    it('create method calls clearAllCache with custom store', async () => {
      const getData = jest.fn((id: string) => `data-${id}`);
      const createData = jest.fn(async (data: { value: string }) => {
        // Clear cache when creating new data
        await cachedService.clearAllCache();
        return { id: 'new', ...data };
      });

      const service = { getData, createData };
      const customStore = new Keyv();
      const cachedService = cacheService(service, { store: customStore });

      // Cache some initial data
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(1);

      // Create new data (this should clear the cache)
      const result = await cachedService.createData({ value: 'test' });
      expect(result).toEqual({ id: 'new', value: 'test' });
      expect(createData).toHaveBeenCalledTimes(1);

      // Verify that cached data is cleared
      await cachedService.getData('1');
      expect(getData).toHaveBeenCalledTimes(2); // Called again due to cache clear
    });
  });
});
