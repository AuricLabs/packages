import { logger } from '@auriclabs/logger';
import Keyv, { KeyvOptions, KeyvStoreAdapter } from 'keyv';

/**
 * Create a new Keyv instance
 * @param store - The store to use
 * @param options - The options to use
 * @returns The new Keyv instance
 */
export function createCache(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store?: KeyvStoreAdapter | KeyvOptions | Map<any, any> | Keyv,
  options?: Omit<KeyvOptions, 'store'>,
) {
  logger.info(
    {
      hasStore: !!store,
      options: options ? Object.keys(options) : [],
    },
    'Creating new Keyv instance',
  );

  if (store instanceof Keyv) {
    logger.info(
      {
        namespace: store.namespace,
      },
      'Using provided Keyv instance',
    );
    return store;
  } else {
    const newCache = new Keyv(store, options);
    logger.info(
      {
        namespace: newCache.namespace,
        ttl: options?.ttl,
      },
      'Created new Keyv instance',
    );
    return newCache;
  }
}
