// Main exports
export { parse, parseFile, parseFileSync } from './parser';

// Types
export type {
  FileFormat,
  ParseOptions,
  ParseResult,
  TomletteParseError,
  VariableSyntax,
} from './types';

// Utilities
export { inferType } from './type-inference';
export { resolveVariables } from './variable-resolution';

// Advanced usage - individual parsers
export { parseMixedContent } from './mixed-parser';
export { parseTomlContent } from './parsers/toml-parser';
export { parseYamlContent } from './parsers/yaml-parser';
export { parsePropertiesContent } from './parsers/properties-parser';