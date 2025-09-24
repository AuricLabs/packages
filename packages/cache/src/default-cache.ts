import Keyv, { KeyvOptions, KeyvStoreAdapter } from 'keyv';

export let defaultCache = new Keyv<unknown>({
  ttl: 1000 * 60 * 5, // 5 minutes
  namespace: undefined,
});

/**
 * Re-assigns the defaultCache variable which is used throughout the cache methods.
 * @param newDefaultCache the new default cache instance to use
 */
export function configureDefaultCache(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store?: KeyvStoreAdapter | KeyvOptions | Map<any, any> | Keyv,
  options?: Omit<KeyvOptions, 'store'>,
) {
  if (store instanceof Keyv) {
    defaultCache = store;
  } else {
    defaultCache = new Keyv(store, options);
  }
}
