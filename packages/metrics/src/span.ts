import { recordMetrics } from './metrics';

const scopes: string[] = [];

export function span<T>(name: string, fn: () => Promise<T>): Promise<T>;
export function span<T>(name: string, fn: () => T): T;
export function span(name: string, fn: () => Promise<void>): Promise<void>;
export function span(name: string, fn: () => void): void;
export function span<T>(name: string, fn: () => Promise<T> | T): Promise<T> | T {
  scopes.push(name);
  const start = performance.now();
  let error: unknown;

  const cleanup = () => {
    const duration = performance.now() - start;
    recordMetrics(scopes.join('.'), duration, error);
    scopes.pop();
  };

  try {
    const result = fn();
    if (result instanceof Promise) {
      return result
        .catch((err: unknown) => {
          error = err;
          throw err;
        })
        .finally(cleanup);
    }
    cleanup();
    return result;
  } catch (err) {
    error = err;
    cleanup();
    throw err;
  }
}
