import { describe, it, expect } from '@jest/globals';
import Keyv from 'keyv';

import { cache } from './cache';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('cache', () => {
  it('caches the result of a function', async () => {
    const store = new Keyv();
    let calls = 0;
    const fn = () => {
      calls++;
      return 'result';
    };

    const result1 = await cache('key', fn, { store });
    expect(result1).toBe('result');
    expect(calls).toBe(1);

    const result2 = await cache('key', fn, { store });
    expect(result2).toBe('result');
    expect(calls).toBe(1);
  });

  it('handles inflight requests', async () => {
    const store = new Keyv();
    let calls = 0;
    const fn = () =>
      sleep(50).then(() => {
        calls++;
        return 'result';
      });

    const [result1, result2] = await Promise.all([
      cache('key', fn, { store }),
      cache('key', fn, { store }),
    ]);

    expect(result1).toBe('result');
    expect(result2).toBe('result');
    expect(calls).toBe(1);
  });

  it('respects ttl', async () => {
    const store = new Keyv();
    let calls = 0;
    const fn = () => {
      calls++;
      return 'result';
    };

    await cache('key', fn, { ttl: 100, store });
    expect(calls).toBe(1);

    await cache('key', fn, { store });
    expect(calls).toBe(1); // still cached

    await sleep(150);

    await cache('key', fn, { store });
    expect(calls).toBe(2); // expired
  });

  it('works with synchronous functions', async () => {
    const store = new Keyv();
    let calls = 0;
    const fn = () => {
      calls++;
      return 'sync result';
    };

    const result1 = await cache('key', fn, { store });
    expect(result1).toBe('sync result');
    expect(calls).toBe(1);

    const result2 = await cache('key', fn, { store });
    expect(result2).toBe('sync result');
    expect(calls).toBe(1);
  });
});
