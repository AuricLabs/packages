/**
 * Supported file formats for parsing
 */
export type FileFormat = 'toml' | 'yaml' | 'properties' | 'auto';

/**
 * Variable syntax types supported
 */
export type VariableSyntax = '${}' | '$' | '{{}}';

/**
 * Configuration options for the parser
 */
export interface ParseOptions {
  /** Variables to use for substitution */
  variables?: Record<string, unknown>;
  /** Whether to use lenient parsing (default: true) */
  lenient?: boolean;
  /** Logger instance for debugging */
  logger?: {
    debug: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}

/**
 * Result of parsing a file
 */
export interface ParseResult {
  /** The parsed data */
  data: Record<string, unknown>;
  /** Any warnings encountered during parsing */
  warnings: string[];
}

/**
 * Error thrown when parsing fails
 */
export class TomletteParseError extends Error {
  constructor(
    message: string,
    public readonly format: FileFormat,
    public readonly line?: number,
    public readonly column?: number,
  ) {
    super(message);
    this.name = 'TomletteParseError';
  }
}
