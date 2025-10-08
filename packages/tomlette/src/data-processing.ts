import { inferType } from './type-inference.js';
import { resolveVariables } from './variable-resolution.js';

/**
 * Processes parsed data to resolve variables and infer types
 */
export function processParsedData(
  data: unknown,
  variables: Record<string, unknown>,
  logger?: { warn: (message: string, ...args: unknown[]) => void },
  warnings: string[] = [],
): unknown {
  if (typeof data === 'string') {
    return processValue(data, variables, logger, warnings);
  }

  if (Array.isArray(data)) {
    return data.map((item) => processParsedData(item, variables, logger, warnings));
  }

  if (data && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = processParsedData(value, variables, logger, warnings);
    }
    return result;
  }

  return data;
}

/**
 * Processes a single value, handling type inference and variable resolution
 */
export function processValue(
  value: string,
  variables: Record<string, unknown>,
  logger?: { warn: (message: string, ...args: unknown[]) => void },
  warnings: string[] = [],
): unknown {
  try {
    // First resolve variables
    const resolvedValue = resolveVariables(value, variables, logger);

    // If it's still a string after variable resolution, infer its type
    if (typeof resolvedValue === 'string') {
      return inferType(resolvedValue);
    }

    return resolvedValue;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    warnings.push(`Error processing value "${value}": ${errorMessage}`);
    logger?.warn(`Error processing value "${value}": ${errorMessage}`);
    return value; // Return original value on error
  }
}
