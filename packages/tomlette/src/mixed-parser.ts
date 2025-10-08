import { parsePropertiesContent } from './parsers/properties-parser';
import { parseTomlContent } from './parsers/toml-parser';
import { parseYamlContent } from './parsers/yaml-parser';

import type { ParseOptions, ParseResult, FileFormat } from './types';

/**
 * Represents a section of content with its detected format
 */
interface ContentSection {
  content: string;
  format: FileFormat;
  startLine: number;
  endLine: number;
}

/**
 * Parses mixed syntax content by detecting sections and parsing each appropriately
 */
export function parseMixedContent(content: string, options: ParseOptions = {}): ParseResult {
  const { variables = {}, logger } = options;
  const warnings: string[] = [];

  logger?.debug('Parsing mixed syntax content');

  try {
    // Split content into sections based on format indicators
    const sections = detectSections(content);
    logger?.debug(`Detected ${sections.length} sections`);

    const result: Record<string, unknown> = {};

    for (const section of sections) {
      logger?.debug(`Parsing section ${section.startLine}-${section.endLine} as ${section.format}`);

      try {
        const sectionResult = parseSection(section, { ...options, variables });

        // Merge the section result into the main result
        mergeResults(result, sectionResult.data);

        // Add any warnings from this section
        warnings.push(...sectionResult.warnings);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const warning = `Failed to parse section ${section.startLine}-${section.endLine} (${section.format}): ${errorMessage}`;
        warnings.push(warning);
        logger?.warn(warning);

        // Continue parsing other sections even if one fails
      }
    }

    return {
      data: result,
      warnings,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger?.error('Mixed content parsing failed:', errorMessage);
    throw new Error(`Mixed content parsing failed: ${errorMessage}`);
  }
}

/**
 * Detects sections in the content and determines their format
 */
function detectSections(content: string): ContentSection[] {
  const lines = content.split('\n');
  const sections: ContentSection[] = [];

  let currentSection: ContentSection | null = null;
  let currentFormat: FileFormat | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments for detection
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Detect format based on line content
    const detectedFormat = detectLineFormat(line);

    // If we detect a new format or this is the first non-empty line
    if (detectedFormat && detectedFormat !== currentFormat) {
      // Save previous section if it exists
      if (currentSection) {
        currentSection.endLine = i - 1;
        sections.push(currentSection);
      }

      // Start new section
      currentFormat = detectedFormat;
      currentSection = {
        content: '',
        format: currentFormat,
        startLine: i,
        endLine: i,
      };
    }

    // Add line to current section
    if (currentSection) {
      currentSection.content += line + '\n';
      currentSection.endLine = i;
    }
  }

  // Add the last section
  if (currentSection) {
    sections.push(currentSection);
  }

  // If no sections were detected, treat the entire content as properties
  if (sections.length === 0) {
    sections.push({
      content,
      format: 'properties',
      startLine: 0,
      endLine: lines.length - 1,
    });
  }

  return sections;
}

/**
 * Detects the format of a single line
 */
function detectLineFormat(line: string): FileFormat | null {
  const trimmed = line.trim();

  // TOML indicators
  if (
    (trimmed.startsWith('[') && trimmed.endsWith(']')) || // TOML table headers
    (trimmed.includes('=') && !trimmed.includes(':') && !trimmed.startsWith('#')) || // TOML key=value
    trimmed.includes('"""') || // TOML multiline strings
    trimmed.includes("'''") // TOML multiline strings
  ) {
    return 'toml';
  }

  // YAML indicators
  if (
    (trimmed.includes(':') && !trimmed.includes('=') && !trimmed.startsWith('#')) || // YAML key: value
    /^\s*-\s+/.exec(trimmed) || // YAML list items
    /^\s*[a-zA-Z_][a-zA-Z0-9_]*:\s*$/.exec(trimmed) // YAML object keys
  ) {
    return 'yaml';
  }

  // Properties indicators
  if (
    (trimmed.includes('=') &&
      !trimmed.includes(':') &&
      !trimmed.includes('[') &&
      !trimmed.includes('{') &&
      !trimmed.startsWith('#')) ||
    /^[a-zA-Z_][a-zA-Z0-9_.]*\s*=/.exec(trimmed)
  ) {
    return 'properties';
  }

  return null;
}

/**
 * Parses a single section using the appropriate parser
 */
function parseSection(section: ContentSection, options: ParseOptions): ParseResult {
  switch (section.format) {
    case 'toml':
      return parseTomlContent(section.content, options);
    case 'yaml':
      return parseYamlContent(section.content, options);
    case 'properties':
      return parsePropertiesContent(section.content, options);
    default:
      throw new Error(`Unsupported section format: ${section.format}`);
  }
}

/**
 * Merges results from different sections, with later sections overriding earlier ones
 */
function mergeResults(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    if (
      key in target &&
      typeof target[key] === 'object' &&
      typeof value === 'object' &&
      target[key] !== null &&
      value !== null &&
      !Array.isArray(target[key]) &&
      !Array.isArray(value)
    ) {
      // Deep merge objects
      mergeResults(target[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      // Override or set new value
      target[key] = value;
    }
  }
}
