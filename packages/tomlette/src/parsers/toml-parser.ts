import { parse as parseToml } from 'toml';
import { processParsedData } from '../data-processing.js';
import type { ParseOptions, ParseResult } from '../types.js';

/**
 * Parses TOML content
 */
export function parseTomlContent(
  content: string,
  options: ParseOptions = {},
): ParseResult {
  const { variables = {}, logger } = options;
  const warnings: string[] = [];

  try {
    // Parse TOML first
    const rawData = parseToml(content) as Record<string, unknown>;
    
    // Process the data to resolve variables and infer types
    const processedData = processParsedData(rawData, variables, logger, warnings);

    return {
      data: processedData,
      warnings,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error('TOML parsing failed:', errorMessage);
    throw new Error(`TOML parsing failed: ${errorMessage}`);
  }
}
