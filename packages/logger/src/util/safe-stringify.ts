/**
 * Custom replacer function for JSON.stringify
 * Receives the key and value, returns the transformed value
 */
export type JsonReplacer = (key: string, value: unknown) => unknown;

/**
 * Default JSON replacer that handles non-serializable values gracefully.
 * For objects that can't be serialized, it returns a descriptive string.
 */
export const defaultJsonReplacer: JsonReplacer = (_key: string, value: unknown): unknown => {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle primitives directly
  if (typeof value !== 'object' && typeof value !== 'function') {
    return value;
  }

  // Handle functions
  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`;
  }

  // Handle special object types that JSON.stringify can't handle
  if (value instanceof RegExp) {
    return `[RegExp: ${String(value)}]`;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === 'symbol') {
    return `[Symbol: ${String(value)}]`;
  }

  if (value instanceof Map) {
    return `[Map(${value.size}): ${JSON.stringify([...value.entries()])}]`;
  }

  if (value instanceof Set) {
    return `[Set(${value.size}): ${JSON.stringify([...value.values()])}]`;
  }

  if (value instanceof WeakMap) {
    return '[WeakMap]';
  }

  if (value instanceof WeakSet) {
    return '[WeakSet]';
  }

  // Pass through regular objects and arrays for further processing
  return value;
};

/**
 * Safely stringify a value, falling back to a descriptive string if JSON.stringify fails.
 */
export const safeStringifyValue = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (typeof value === 'object') {
    const constructorName = value.constructor.name;
    // Try to get a meaningful string representation
    try {
      const stringified = JSON.stringify(value);
      return `[${constructorName}: ${stringified}]`;
    } catch {
      // For objects that can't be stringified, use constructor name only
      return `[${constructorName}]`;
    }
  }

  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`;
  }

  if (typeof value === 'symbol') {
    return `[symbol: ${value.toString()}]`;
  }

  if (typeof value === 'bigint') {
    return `[bigint: ${value.toString()}]`;
  }

  if (typeof value === 'string') {
    return `[string: ${value}]`;
  }

  if (typeof value === 'number') {
    return `[number: ${value}]`;
  }

  if (typeof value === 'boolean') {
    return `[boolean: ${value}]`;
  }

  // Fallback for any other types (should not reach here in practice)
  return '[unknown]';
};

/**
 * Recursively process a value, handling circular references.
 * Returns a new value that is safe to stringify.
 */
const processValue = (
  value: unknown,
  replacer: JsonReplacer,
  key: string,
  seen: WeakSet<object>,
): unknown => {
  // Apply the replacer first
  const replaced = replacer(key, value);

  // Handle null and primitives (replacer might have transformed the value)
  if (replaced === null || replaced === undefined) {
    return replaced;
  }

  if (typeof replaced !== 'object') {
    return replaced;
  }

  // Check for circular references
  if (seen.has(replaced)) {
    return '[Circular]';
  }

  // Add to seen set
  seen.add(replaced);

  // Handle arrays
  if (Array.isArray(replaced)) {
    const result: unknown[] = [];
    for (let i = 0; i < replaced.length; i++) {
      result.push(processValue(replaced[i], replacer, String(i), seen));
    }
    return result;
  }

  // Handle plain objects
  const result: Record<string, unknown> = {};
  for (const objKey of Object.keys(replaced)) {
    try {
      result[objKey] = processValue(
        (replaced as Record<string, unknown>)[objKey],
        replacer,
        objKey,
        seen,
      );
    } catch {
      // If processing fails, use safe fallback
      result[objKey] = safeStringifyValue((replaced as Record<string, unknown>)[objKey]);
    }
  }

  return result;
};

/**
 * Safely stringify an object with a custom replacer, handling circular references and failures gracefully.
 */
export const safeStringify = (
  data: Record<string, unknown>,
  replacer: JsonReplacer = defaultJsonReplacer,
  indent = 2,
): string => {
  const seen = new WeakSet();
  seen.add(data);

  const processedData: Record<string, unknown> = {};

  for (const key of Object.keys(data)) {
    try {
      processedData[key] = processValue(data[key], replacer, key, seen);
    } catch {
      // If processing fails for this property, use safe fallback
      processedData[key] = safeStringifyValue(data[key]);
    }
  }

  try {
    return JSON.stringify(processedData, null, indent);
  } catch {
    // Final fallback: stringify each property individually
    const lines = Object.entries(processedData).map(
      ([key, value]) => `  "${key}": ${safeStringifyValue(value)}`,
    );
    return `{\n${lines.join(',\n')}\n}`;
  }
};
