import { logger } from '@auriclabs/logger';
import Keyv from 'keyv';
import { v4 as uuidv4 } from 'uuid';

import { cache, CacheOptions } from './cache';
import { ArgsSerializer, defaultArgsSerializer } from './default-args-serializer';
import { defaultCache } from './default-cache';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface CacheFunctionOptions<T extends (...args: any[]) => any> extends CacheOptions {
  serializeArgs?: ArgsSerializer<T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CacheFunction<T extends (...args: any[]) => any> = ((
  ...args: Parameters<T>
) => Promise<Awaited<ReturnType<T>>>) & {
  id: string;
  isCacheFunction: true;
  set(
    ...args: [...Parameters<T>, value: Awaited<ReturnType<T>> | ReturnType<T>]
  ): Promise<Awaited<ReturnType<T>>>;
  clear: (...args: Parameters<T>) => Promise<boolean>;
  clearAll: () => Promise<void>;
};

/**
 * Cache a function
 * @param fn - The function to cache
 * @param {CacheFunctionOptions<T>} options - The options for the cache
 * @returns The cached function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cacheFunction<T extends (...args: any[]) => any>(
  fn: T,
  {
    ttl,
    store: baseStore = defaultCache,
    serializeArgs = defaultArgsSerializer,
  }: CacheFunctionOptions<T> = {},
): CacheFunction<T> {
  const uniqueId = uuidv4();
  const store = new Keyv({
    namespace: `${baseStore.namespace ? `${baseStore.namespace}:` : ''}${uniqueId}[${fn.name}]`,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    store: baseStore.store,
  });

  logger.trace(
    {
      functionName: fn.name,
      uniqueId,
      namespace: store.namespace,
      ttl,
    },
    'Creating cache function',
  );

  const cacheFn = async (...args: Parameters<T>) => {
    const key = serializeArgs(args);
    logger.trace(
      {
        functionName: fn.name,
        key,
        argsCount: args.length,
      },
      'Cache function called',
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return cache(key, () => fn(...args), {
      ttl,
      store,
    });
  };

  cacheFn.clear = (...args: Parameters<T>) => {
    const key = serializeArgs(args);
    logger.trace(
      {
        functionName: fn.name,
        key,
      },
      'Clearing cache for function',
    );
    return store.delete(key);
  };

  cacheFn.clearAll = () => {
    logger.trace(
      {
        functionName: fn.name,
        namespace: store.namespace,
      },
      'Clearing all cache for function',
    );
    return store.clear();
  };

  cacheFn.set = async (
    ...args: [...Parameters<T>, value: Awaited<ReturnType<T>> | ReturnType<T>]
  ) => {
    const value = args.pop();
    if (!value) {
      logger.error(
        {
          functionName: fn.name,
        },
        'Cache function set called without value',
      );
      throw new Error('Value is required');
    }
    const key = serializeArgs(args as unknown as Parameters<T>);
    logger.trace(
      {
        functionName: fn.name,
        key,
        ttl,
      },
      'Manually setting cache value',
    );
    await store.set(key, value, ttl);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value;
  };

  cacheFn.id = uniqueId;
  cacheFn.isCacheFunction = true as const;
  return cacheFn;
}
