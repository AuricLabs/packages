import { processValue } from '../data-processing.js';
import type { ParseOptions, ParseResult } from '../types.js';

/**
 * Parses Properties content
 */
export function parsePropertiesContent(
  content: string,
  options: ParseOptions = {},
): ParseResult {
  const { variables = {}, logger } = options;
  const warnings: string[] = [];

  try {
    const lines = content.split('\n');
    const result: Record<string, unknown> = {};
    let currentKey = '';
    let currentValue = '';
    let inMultiline = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Handle multiline values (lines starting with whitespace)
      if (inMultiline && /^\s/.test(line)) {
        currentValue += '\n' + line;
        continue;
      }

      // Process previous key-value pair
      if (currentKey) {
        const processedValue = processValue(currentValue.trim(), variables, logger, warnings);
        setNestedProperty(result, currentKey, processedValue);
        currentKey = '';
        currentValue = '';
        inMultiline = false;
      }

      // Parse new key-value pair
      const equalIndex = line.indexOf('=');
      if (equalIndex === -1) {
        warnings.push(`Invalid line ${i + 1}: ${line}`);
        continue;
      }

      currentKey = line.substring(0, equalIndex).trim();
      currentValue = line.substring(equalIndex + 1);
      inMultiline = true;
    }

    // Process the last key-value pair
    if (currentKey) {
      const processedValue = processValue(currentValue.trim(), variables, logger, warnings);
      setNestedProperty(result, currentKey, processedValue);
    }

    return {
      data: result,
      warnings,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error('Properties parsing failed:', errorMessage);
    throw new Error(`Properties parsing failed: ${errorMessage}`);
  }
}

/**
 * Sets a nested property using dot notation
 */
function setNestedProperty(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];
  
  // Handle array syntax
  if (lastKey.endsWith('[]')) {
    const arrayKey = lastKey.slice(0, -2);
    if (!Array.isArray(current[arrayKey])) {
      current[arrayKey] = [];
    }
    (current[arrayKey] as unknown[]).push(value);
  } else {
    current[lastKey] = value;
  }
}
