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
  return inflight(key, async () => {
    const cached = (await store.get(key)) as R;
    if (cached !== undefined) {
      return cached;
    }
    const result = await fn();
    await store.set(key, result, ttl);
    return result;
  });
}
