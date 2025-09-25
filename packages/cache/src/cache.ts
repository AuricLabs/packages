import { logger } from '@auriclabs/logger';
import Keyv from 'keyv';
import inflight from 'promise-inflight';

import { defaultCache as defaultCache } from './default-cache';

export interface CacheOptions {
  ttl?: number;
  store?: Keyv;
}

/**
 * Cache the result of a function
 * If the function is already cached, it will return the cached result
 * If the function is not cached, it will cache the result and return it
 * If the function is already being executed, it will wait for the result and return it
 * @param key - The key to cache the result of the function
 * @param fn - The function to cache the result of
 * @param {CacheOptions} options - The options for the cache
 * @returns The result of the function
 */
export function cache<R>(
  key: string,
  fn: () => Promise<R> | R,
  { ttl, store = defaultCache }: CacheOptions = {},
): Promise<R> {
  logger.debug({ key, ttl, storeNamespace: store.namespace }, 'Cache operation started');

  return inflight(key, async () => {
    logger.debug({ key }, 'Checking cache for key');
    const cached = (await store.get(key)) as R;

    if (cached !== undefined) {
      logger.debug({ key }, 'Cache hit');
      return cached;
    }

    logger.debug({ key }, 'Cache miss, executing function');
    const result = await fn();
    logger.debug({ key, ttl }, 'Function executed, storing result in cache');
    await store.set(key, result, ttl);
    logger.debug({ key }, 'Cache operation completed');
    return result;
  });
}
