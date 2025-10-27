import { logger } from '@auriclabs/logger';
import Keyv from 'keyv';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { createCache } from './create-cache';

describe('createCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when store is a Keyv instance', () => {
    it('should return the provided Keyv instance', () => {
      const existingKeyv = new Keyv();
      const result = createCache(existingKeyv);

      expect(result).toBe(existingKeyv);
    });

    it('should log info about using provided Keyv instance', () => {
      const existingKeyv = new Keyv();

      createCache(existingKeyv);

      expect(logger.trace).toHaveBeenCalledWith(
        {
          namespace: existingKeyv.namespace,
        },
        'Using provided Keyv instance',
      );
    });

    it('should log initial creation info before checking instance type', () => {
      const existingKeyv = new Keyv();

      createCache(existingKeyv);

      expect(logger.trace).toHaveBeenCalledWith(
        {
          hasStore: true,
          options: [],
        },
        'Creating new Keyv instance',
      );
    });
  });

  describe('when store is not a Keyv instance', () => {
    it('should create a new Keyv instance with no store', () => {
      const result = createCache();

      expect(result).toBeInstanceOf(Keyv);
      expect(result).toBeDefined();
    });

    it('should create a new Keyv instance with Map store', () => {
      const mapStore = new Map();
      const result = createCache(mapStore);

      expect(result).toBeInstanceOf(Keyv);
    });

    it('should create a new Keyv instance with options', () => {
      const options = { ttl: 1000, namespace: 'test-namespace' };
      const result = createCache(undefined, options);

      expect(result).toBeInstanceOf(Keyv);
      expect(result.namespace).toBe('test-namespace');
    });

    it('should create a new Keyv instance with store and options', () => {
      const mapStore = new Map();
      const options = { ttl: 500, namespace: 'test-with-store' };
      const result = createCache(mapStore, options);

      expect(result).toBeInstanceOf(Keyv);
      expect(result.namespace).toBe('test-with-store');
    });

    it('should log creation info when no store provided', () => {
      createCache();

      expect(logger.trace).toHaveBeenCalledWith(
        {
          hasStore: false,
          options: [],
        },
        'Creating new Keyv instance',
      );
    });

    it('should log creation info when store provided but not Keyv instance', () => {
      const mapStore = new Map();

      createCache(mapStore);

      expect(logger.trace).toHaveBeenCalledWith(
        {
          hasStore: true,
          options: [],
        },
        'Creating new Keyv instance',
      );
    });

    it('should log creation info with options keys', () => {
      const options = { ttl: 1000, namespace: 'test' };

      createCache(undefined, options);

      expect(logger.trace).toHaveBeenCalledWith(
        {
          hasStore: false,
          options: ['ttl', 'namespace'],
        },
        'Creating new Keyv instance',
      );
    });

    it('should log successful creation of new Keyv instance', () => {
      const options = { ttl: 2000, namespace: 'creation-test' };

      createCache(undefined, options);

      expect(logger.trace).toHaveBeenCalledWith(
        {
          namespace: 'creation-test',
          ttl: 2000,
        },
        'Created new Keyv instance',
      );
    });

    it('should log successful creation without ttl when not provided', () => {
      const options = { namespace: 'no-ttl-test' };

      createCache(undefined, options);

      expect(logger.trace).toHaveBeenCalledWith(
        {
          namespace: 'no-ttl-test',
          ttl: undefined,
        },
        'Created new Keyv instance',
      );
    });
  });

  describe('edge cases', () => {
    it('should handle null store', () => {
      // @ts-expect-error - test case for null store
      const result = createCache(null);

      expect(result).toBeInstanceOf(Keyv);
    });

    it('should handle empty options object', () => {
      const result = createCache(undefined, {});

      expect(result).toBeInstanceOf(Keyv);
    });

    it('should handle options with undefined values', () => {
      const options = { ttl: undefined, namespace: undefined };
      const result = createCache(undefined, options);

      expect(result).toBeInstanceOf(Keyv);
    });

    it('should handle complex options', () => {
      const options = {
        ttl: 5000,
        namespace: 'complex-test',
        serialize: JSON.stringify,
        deserialize: JSON.parse,
      };
      const result = createCache(undefined, options);

      expect(result).toBeInstanceOf(Keyv);
      expect(result.namespace).toBe('complex-test');
    });
  });

  describe('integration with Keyv functionality', () => {
    it('should create a working cache instance', async () => {
      const cache = createCache();

      await cache.set('test-key', 'test-value');
      const value: unknown = await cache.get('test-key');

      expect(value).toBe('test-value');
    });

    it('should respect ttl option', async () => {
      const cache = createCache(undefined, { ttl: 100 });

      await cache.set('test-key', 'test-value');
      const value1: unknown = await cache.get('test-key');
      expect(value1).toBe('test-value');

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const value2: unknown = await cache.get('test-key');
      expect(value2).toBeUndefined();
    });

    it('should work with custom store', async () => {
      const mapStore = new Map();
      const cache = createCache(mapStore);

      await cache.set('test-key', 'test-value');
      const value: unknown = await cache.get('test-key');

      expect(value).toBe('test-value');
      expect(mapStore.has('keyv:test-key')).toBe(true);
    });
  });
});
