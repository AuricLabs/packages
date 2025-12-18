import { describe, it, expect } from 'vitest';

import {
  defaultJsonReplacer,
  safeStringify,
  safeStringifyValue,
  type JsonReplacer,
} from './safe-stringify';

describe('defaultJsonReplacer', () => {
  it('should return null as-is', () => {
    expect(defaultJsonReplacer('key', null)).toBe(null);
  });

  it('should return undefined as-is', () => {
    expect(defaultJsonReplacer('key', undefined)).toBe(undefined);
  });

  it('should return primitives as-is', () => {
    expect(defaultJsonReplacer('key', 'string')).toBe('string');
    expect(defaultJsonReplacer('key', 123)).toBe(123);
    expect(defaultJsonReplacer('key', true)).toBe(true);
    expect(defaultJsonReplacer('key', false)).toBe(false);
  });

  it('should handle functions', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const namedFn = function myFunction() {};
    expect(defaultJsonReplacer('key', namedFn)).toBe('[Function: myFunction]');

    // When assigning an anonymous function to a variable, JS assigns the variable name
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const anonymousFn = function () {};
    expect(defaultJsonReplacer('key', anonymousFn)).toBe('[Function: anonymousFn]');

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const arrowFn = () => {};
    expect(defaultJsonReplacer('key', arrowFn)).toBe('[Function: arrowFn]');
  });

  it('should handle RegExp', () => {
    expect(defaultJsonReplacer('key', /test/gi)).toBe('[RegExp: /test/gi]');
    expect(defaultJsonReplacer('key', new RegExp('pattern', 'i'))).toBe('[RegExp: /pattern/i]');
  });

  it('should handle Error objects', () => {
    const error = new Error('test error');
    const result = defaultJsonReplacer('key', error);
    expect(result).toEqual({
      name: 'Error',
      message: 'test error',
      stack: error.stack,
    });
  });

  it('should handle custom Error types', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    const error = new CustomError('custom error');
    const result = defaultJsonReplacer('key', error);
    expect(result).toEqual({
      name: 'CustomError',
      message: 'custom error',
      stack: error.stack,
    });
  });

  it('should handle Map', () => {
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    expect(defaultJsonReplacer('key', map)).toBe('[Map(2): [["a",1],["b",2]]]');
  });

  it('should handle empty Map', () => {
    const map = new Map();
    expect(defaultJsonReplacer('key', map)).toBe('[Map(0): []]');
  });

  it('should handle Set', () => {
    const set = new Set([1, 2, 3]);
    expect(defaultJsonReplacer('key', set)).toBe('[Set(3): [1,2,3]]');
  });

  it('should handle empty Set', () => {
    const set = new Set();
    expect(defaultJsonReplacer('key', set)).toBe('[Set(0): []]');
  });

  it('should handle WeakMap', () => {
    const weakMap = new WeakMap();
    expect(defaultJsonReplacer('key', weakMap)).toBe('[WeakMap]');
  });

  it('should handle WeakSet', () => {
    const weakSet = new WeakSet();
    expect(defaultJsonReplacer('key', weakSet)).toBe('[WeakSet]');
  });

  it('should pass through regular objects', () => {
    const obj = { a: 1, b: 'test' };
    expect(defaultJsonReplacer('key', obj)).toBe(obj);
  });

  it('should pass through arrays', () => {
    const arr = [1, 2, 3];
    expect(defaultJsonReplacer('key', arr)).toBe(arr);
  });
});

describe('safeStringifyValue', () => {
  it('should stringify null', () => {
    expect(safeStringifyValue(null)).toBe('null');
  });

  it('should stringify undefined', () => {
    expect(safeStringifyValue(undefined)).toBe('undefined');
  });

  it('should stringify objects with constructor name and JSON', () => {
    const obj = { a: 1 };
    expect(safeStringifyValue(obj)).toBe('[Object: {"a":1}]');
  });

  it('should stringify arrays with constructor name and JSON', () => {
    const arr = [1, 2, 3];
    expect(safeStringifyValue(arr)).toBe('[Array: [1,2,3]]');
  });

  it('should handle objects with circular references', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    expect(safeStringifyValue(obj)).toBe('[Object]');
  });

  it('should stringify functions', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const namedFn = function myFunc() {};
    expect(safeStringifyValue(namedFn)).toBe('[Function: myFunc]');

    // When assigning an anonymous function to a variable, JS assigns the variable name
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const anonymousFn = function () {};
    expect(safeStringifyValue(anonymousFn)).toBe('[Function: anonymousFn]');
  });

  it('should stringify symbols', () => {
    const sym = Symbol('test');
    expect(safeStringifyValue(sym)).toBe('[symbol: Symbol(test)]');
  });

  it('should stringify bigint', () => {
    const big = BigInt(123456789);
    expect(safeStringifyValue(big)).toBe('[bigint: 123456789]');
  });

  it('should stringify strings', () => {
    expect(safeStringifyValue('hello')).toBe('[string: hello]');
  });

  it('should stringify numbers', () => {
    expect(safeStringifyValue(42)).toBe('[number: 42]');
    expect(safeStringifyValue(3.14)).toBe('[number: 3.14]');
  });

  it('should stringify booleans', () => {
    expect(safeStringifyValue(true)).toBe('[boolean: true]');
    expect(safeStringifyValue(false)).toBe('[boolean: false]');
  });

  it('should handle Date objects', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    expect(safeStringifyValue(date)).toBe('[Date: "2024-01-01T00:00:00.000Z"]');
  });
});

describe('safeStringify', () => {
  it('should stringify simple objects', () => {
    const data = { name: 'test', value: 123 };
    const result = safeStringify(data);
    expect(JSON.parse(result)).toEqual({ name: 'test', value: 123 });
  });

  it('should use default replacer when none provided', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const data = { fn: function myFunc() {} };
    const result = safeStringify(data);
    expect(JSON.parse(result)).toEqual({ fn: '[Function: myFunc]' });
  });

  it('should use custom replacer', () => {
    const customReplacer: JsonReplacer = (_key, value) => {
      if (typeof value === 'string') {
        return value.toUpperCase();
      }
      return value;
    };

    const data = { name: 'test', count: 5 };
    const result = safeStringify(data, customReplacer);
    expect(JSON.parse(result)).toEqual({ name: 'TEST', count: 5 });
  });

  it('should handle direct circular references', () => {
    const circular: Record<string, unknown> = { value: 'test' };
    circular.self = circular;

    const data = { normal: 'value', problematic: circular };
    const result = safeStringify(data);
    const parsed = JSON.parse(result) as {
      normal: string;
      problematic: { value: string; self: string };
    };

    expect(parsed.normal).toBe('value');
    expect(parsed.problematic.value).toBe('test');
    expect(parsed.problematic.self).toBe('[Circular]');
  });

  it('should handle nested circular references', () => {
    const obj: Record<string, unknown> = {
      name: 'root',
      child: {
        name: 'child',
      },
    };
    (obj.child as Record<string, unknown>).parent = obj;

    const result = safeStringify(obj);
    const parsed = JSON.parse(result) as {
      name: string;
      child: { name: string; parent: string };
    };

    expect(parsed.name).toBe('root');
    expect(parsed.child.name).toBe('child');
    expect(parsed.child.parent).toBe('[Circular]');
  });

  it('should handle circular references in arrays', () => {
    const arr: unknown[] = [1, 2, 3];
    arr.push(arr);

    const data = { items: arr };
    const result = safeStringify(data);
    const parsed = JSON.parse(result) as { items: (number | string)[] };

    expect(parsed.items[0]).toBe(1);
    expect(parsed.items[1]).toBe(2);
    expect(parsed.items[2]).toBe(3);
    expect(parsed.items[3]).toBe('[Circular]');
  });

  it('should handle multiple references to same object (not circular)', () => {
    const shared = { value: 'shared' };
    const data = {
      first: shared,
      second: shared,
    };

    const result = safeStringify(data);
    const parsed = JSON.parse(result) as {
      first: { value: string } | string;
      second: { value: string } | string;
    };

    // First occurrence is serialized normally
    expect(parsed.first).toEqual({ value: 'shared' });
    // Second occurrence is detected as already seen
    expect(parsed.second).toBe('[Circular]');
  });

  it('should handle deeply nested circular references', () => {
    const root: Record<string, unknown> = {
      level1: {
        level2: {
          level3: {},
        },
      },
    };
    ((root.level1 as Record<string, unknown>).level2 as Record<string, unknown>).level3 = {
      backToRoot: root,
    };

    const result = safeStringify(root);
    const parsed = JSON.parse(result) as {
      level1: {
        level2: {
          level3: { backToRoot: string };
        };
      };
    };

    expect(parsed.level1.level2.level3.backToRoot).toBe('[Circular]');
  });

  it('should handle custom indent', () => {
    const data = { a: 1 };
    const result = safeStringify(data, defaultJsonReplacer, 4);
    expect(result).toBe('{\n    "a": 1\n}');
  });

  it('should handle empty objects', () => {
    const result = safeStringify({});
    expect(result).toBe('{}');
  });

  it('should handle nested objects', () => {
    const data = {
      level1: {
        level2: {
          value: 'deep',
        },
      },
    };
    const result = safeStringify(data);
    expect(JSON.parse(result)).toEqual(data);
  });

  it('should handle arrays in objects', () => {
    const data = { items: [1, 2, 3], names: ['a', 'b'] };
    const result = safeStringify(data);
    expect(JSON.parse(result)).toEqual(data);
  });

  it('should handle Map and Set with default replacer', () => {
    const data = {
      myMap: new Map([['key', 'value']]),
      mySet: new Set([1, 2, 3]),
    };
    const result = safeStringify(data);
    const parsed = JSON.parse(result) as { myMap: string; mySet: string };
    expect(parsed.myMap).toBe('[Map(1): [["key","value"]]]');
    expect(parsed.mySet).toBe('[Set(3): [1,2,3]]');
  });

  it('should handle Error objects with default replacer', () => {
    const error = new Error('test error');
    const data = { error };
    const result = safeStringify(data);
    const parsed = JSON.parse(result) as {
      error: { name: string; message: string; stack: string };
    };
    expect(parsed.error.name).toBe('Error');
    expect(parsed.error.message).toBe('test error');
    expect(parsed.error.stack).toBeDefined();
  });

  it('should handle mixed types', () => {
    const data = {
      string: 'hello',
      number: 42,
      boolean: true,
      nullValue: null,
      array: [1, 2, 3],
      nested: { a: 1 },
    };
    const result = safeStringify(data);
    expect(JSON.parse(result)).toEqual(data);
  });
});
