/**
 * Infers the type of a string value, similar to JSON5 behavior
 */
export function inferType(value: string): unknown {
  const trimmed = value.trim();

  // Handle null/undefined
  if (trimmed === 'null') return null;
  if (trimmed === 'undefined') return undefined;

  // Handle booleans
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Handle numbers
  if (/^-?\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  if (/^-?\d*\.\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }
  if (/^-?\d+\.\d*[eE][+-]?\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Handle arrays
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return parseArray(trimmed);
  }

  // Handle objects
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return parseObject(trimmed);
  }

  // Handle quoted strings
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Return as string
  return trimmed;
}

/**
 * Parses an array string like [item1, item2, item3]
 */
function parseArray(arrayStr: string): unknown[] {
  const content = arrayStr.slice(1, -1).trim();
  if (!content) return [];

  const elements: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (!inString) {
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        current += char;
      } else if (char === '[' || char === '{') {
        depth++;
        current += char;
      } else if (char === ']' || char === '}') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        elements.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    } else {
      current += char;
      if (char === stringChar && content[i - 1] !== '\\') {
        inString = false;
        stringChar = '';
      }
    }
  }

  if (current.trim()) {
    elements.push(current.trim());
  }

  return elements.map(element => inferType(element));
}

/**
 * Parses an object string like {key: value, key2: value2}
 */
function parseObject(objStr: string): Record<string, unknown> {
  const content = objStr.slice(1, -1).trim();
  if (!content) return {};

  const result: Record<string, unknown> = {};
  let current = '';
  let key = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let expectingValue = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (!inString) {
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        current += char;
      } else if (char === '[' || char === '{') {
        depth++;
        current += char;
      } else if (char === ']' || char === '}') {
        depth--;
        current += char;
      } else if (char === ':' && depth === 0 && !expectingValue) {
        key = current.trim();
        current = '';
        expectingValue = true;
      } else if (char === ',' && depth === 0 && expectingValue) {
        result[key] = inferType(current.trim());
        current = '';
        key = '';
        expectingValue = false;
      } else {
        current += char;
      }
    } else {
      current += char;
      if (char === stringChar && content[i - 1] !== '\\') {
        inString = false;
        stringChar = '';
      }
    }
  }

  if (key && current.trim()) {
    result[key] = inferType(current.trim());
  }

  return result;
}
