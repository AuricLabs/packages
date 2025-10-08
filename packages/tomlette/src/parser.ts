import { parseMixedContent } from './mixed-parser';
import type { ParseOptions, ParseResult, TomletteParseError } from './types';

/**
 * Main parser function that handles all supported formats
 */
export function parse(
  content: string,
  options: ParseOptions = {},
): ParseResult {
  const { variables = {}, logger } = options;
  
  logger?.debug('Parsing content with mixed syntax');

  try {
    // Always use mixed parser - it handles everything
    return parseMixedContent(content, options);
  } catch (error: unknown) {
    if (error instanceof TomletteParseError) {
      throw error;
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new TomletteParseError(
      `Failed to parse content: ${errorMessage}`,
      'auto',
    );
  }
}

/**
 * Parse content from a file path
 */
export async function parseFile(
  filePath: string,
  options: ParseOptions = {},
): Promise<ParseResult> {
  const { logger } = options;
  
  try {
    const content = await import('fs').then(fs => fs.promises.readFile(filePath, 'utf-8'));
    return parse(content, options);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Failed to read file ${filePath}:`, errorMessage);
    throw new Error(`Failed to read file ${filePath}: ${errorMessage}`);
  }
}

/**
 * Parse content synchronously from a file path
 */
export function parseFileSync(
  filePath: string,
  options: ParseOptions = {},
): ParseResult {
  const { logger } = options;
  
  try {
    const fs = require('fs');
    const content = fs.readFileSync(filePath, 'utf-8');
    return parse(content, options);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error(`Failed to read file ${filePath}:`, errorMessage);
    throw new Error(`Failed to read file ${filePath}: ${errorMessage}`);
  }
}

// Re-export types and utilities
export type { FileFormat, ParseOptions, ParseResult, TomletteParseError, VariableSyntax };
export { TomletteParseError } from './types';
export { inferType } from './type-inference';
export { resolveVariables } from './variable-resolution';
