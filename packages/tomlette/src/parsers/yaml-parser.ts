import { parse as parseYaml } from 'yaml';

import { processParsedData } from '../data-processing.js';

import type { ParseOptions, ParseResult } from '../types.js';

/**
 * Parses YAML content
 */
export function parseYamlContent(content: string, options: ParseOptions = {}): ParseResult {
  const { variables = {}, logger } = options;
  const warnings: string[] = [];

  try {
    // Parse YAML first
    const rawData = parseYaml(content, {
      strict: false, // Use lenient parsing
      prettyErrors: false,
    }) as Record<string, unknown>;

    // Process the data to resolve variables and infer types
    const processedData = processParsedData(rawData, variables, logger, warnings);

    return {
      data: processedData,
      warnings,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error('YAML parsing failed:', errorMessage);
    throw new Error(`YAML parsing failed: ${errorMessage}`);
  }
}
