import Keyv from 'keyv';
import { v4 as uuidv4 } from 'uuid';

import { CacheFunction, cacheFunction } from './cache-function';
import { defaultCache } from './default-cache';

export interface CacheServiceOptions<S extends Record<string, unknown>, P extends string> {
  ttl?: number;
  store?: Keyv;
  namespace?: string;
  cacheFunctionPrefix?: P;
  ignoreMethods?: (keyof S)[];
  serializeArgs?: <K extends keyof S>(
    key: K,
    args: S[K] extends (...args: any[]) => any ? Parameters<S[K]> : never,
  ) => string;
}

export type CachedService<S extends Record<string, unknown>, P extends string = 'get'> = {
  [K in keyof S]: S[K] extends (...args: any[]) => any
    ? K extends `${P}${string}`
      ? CacheFunction<S[K]>
      : S[K]
    : S[K];
} & {
  clearAllCache: () => Promise<void>;
};

/**
 * Cache a service's functions
 * @param service - The service to cache
 * @param {CacheServiceOptions<S>} options - The options for the cache
 * @returns The cached service
 */
export function cacheService<S extends Record<string, unknown>, P extends string = 'get'>(
  service: S,
  {
    ttl,
    store: baseStore = defaultCache,
    namespace,
    cacheFunctionPrefix = 'get' as P,
    ignoreMethods = [],
    serializeArgs,
  }: CacheServiceOptions<S, P> = {},
): CachedService<S, P> {
  const serviceNamespace = 'name' in service ? String(service.name) : (namespace ?? uuidv4());
  const store = new Keyv({
    namespace: `${baseStore.namespace ? `${baseStore.namespace}:` : ''}${serviceNamespace}`,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    store: baseStore.store,
  });
  const descriptors = Object.entries(Object.getOwnPropertyDescriptors(service));
  const newService = {} as CachedService<S, P>;

  return Object.defineProperties(
    newService,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    Object.fromEntries(
      descriptors
        .map(([key, descriptor]) => {
          if (
            descriptor.value &&
            typeof descriptor.value === 'function' &&
            key.startsWith(cacheFunctionPrefix) &&
            !('isCacheFunction' in descriptor.value) &&
            !ignoreMethods.includes(key as keyof S)
          ) {
            return [
              key,
              {
                ...descriptor,
                value: cacheFunction(descriptor.value, {
                  ttl,
                  store,
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  serializeArgs: serializeArgs?.bind(newService, key as keyof S) as any,
                }),
              },
            ];
          }
          return [key, descriptor];
        })
        .concat([
          [
            'clearAllCache',
            {
              writable: true,
              configurable: true,
              // @ts-expect-error - clearAllCache is a function
              value: () => store.clear(),
            },
          ],
        ]),
    ),
  );
}
