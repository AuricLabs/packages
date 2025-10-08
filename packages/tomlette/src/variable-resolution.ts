import type { VariableSyntax } from './types';

/**
 * Resolves variables in a string using multiple syntax formats
 */
export function resolveVariables(
  value: string,
  variables: Record<string, unknown>,
  logger?: { warn: (message: string, ...args: unknown[]) => void },
): unknown {
  // Check for array-like syntax first
  const arrayMatch = /^\[(.*)\]$/.exec(value);
  if (arrayMatch) {
    const arrayContent = arrayMatch[1];
    if (arrayContent.trim() === '') {
      return [];
    }
    const elements = parseArrayElements(arrayContent);
    return elements.map((element) => resolveVariables(element.trim(), variables, logger));
  }

  // Check for different variable syntaxes
  const syntaxes: VariableSyntax[] = ['${}', '$', '{{}}'];
  
  for (const syntax of syntaxes) {
    const resolved = resolveVariableSyntax(value, variables, syntax, logger);
    if (resolved !== value) {
      return resolved;
    }
  }

  // Check for mixed variable interpolation
  const interpolated = interpolateVariables(value, variables, logger);
  if (interpolated !== value) {
    return interpolated;
  }

  return value;
}

/**
 * Resolves variables using a specific syntax
 */
function resolveVariableSyntax(
  value: string,
  variables: Record<string, unknown>,
  syntax: VariableSyntax,
  logger?: { warn: (message: string, ...args: unknown[]) => void },
): unknown {
  let pattern: RegExp;
  let extractPath: (match: string) => string;

  switch (syntax) {
    case '${}':
      pattern = /^\${([^{}]+)}$/;
      extractPath = (match) => match.slice(2, -1);
      break;
    case '$':
      pattern = /^\$([a-zA-Z_][a-zA-Z0-9_.]*)$/;
      extractPath = (match) => match.slice(1);
      break;
    case '{{}}':
      pattern = /^{{([^{}]+)}}$/;
      extractPath = (match) => match.slice(2, -2);
      break;
    default:
      return value;
  }

  const match = pattern.exec(value);
  if (match) {
    const propertyPath = extractPath(match[0]);
    const resolvedValue = resolveVariable(propertyPath, variables, logger);
    
    if (resolvedValue === undefined) {
      const errorMsg = `Variable ${propertyPath} not found in variables`;
      logger?.warn(errorMsg);
      throw new Error(errorMsg);
    }

    return resolvedValue;
  }

  return value;
}

/**
 * Interpolates multiple variables in a string
 */
function interpolateVariables(
  value: string,
  variables: Record<string, unknown>,
  logger?: { warn: (message: string, ...args: unknown[]) => void },
): string {
  const syntaxes: Array<{ pattern: RegExp; extractPath: (match: string) => string }> = [
    { pattern: /\${([^{}]+?)}/g, extractPath: (match) => match.slice(2, -1) },
    { pattern: /\$([a-zA-Z_][a-zA-Z0-9_.]*)/g, extractPath: (match) => match.slice(1) },
    { pattern: /{{([^{}]+?)}}/g, extractPath: (match) => match.slice(2, -2) },
  ];

  let result = value;

  for (const { pattern, extractPath } of syntaxes) {
    const matches = result.match(pattern);
    if (matches) {
      for (const match of matches) {
        const propertyPath = extractPath(match);
        const resolvedValue = resolveVariable(propertyPath, variables, logger);
        
        if (resolvedValue === undefined) {
          const errorMsg = `Variable ${propertyPath} not found in variables`;
          logger?.warn(errorMsg);
          throw new Error(errorMsg);
        }

        result = result.replace(match, String(resolvedValue));
      }
    }
  }

  return result;
}

/**
 * Resolves a variable path using unsafe function execution for maximum flexibility
 */
function resolveVariable(
  path: string,
  variables: Record<string, unknown>,
  logger?: { warn: (message: string, ...args: unknown[]) => void },
): unknown {
  try {
    // Create a function that has access to the variables object
    // This allows for complex expressions, function calls, and logic
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const evalInContext = new Function('variables', `return variables.${path}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return evalInContext(variables);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorMsg = `Error evaluating "${path}": ${errorMessage}`;
    logger?.warn(errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Parse array elements from a string, respecting variable references
 * Handles commas inside variable references properly
 */
function parseArrayElements(arrayContent: string): string[] {
  const elements: string[] = [];
  let currentElement = '';
  let braceDepth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < arrayContent.length; i++) {
    const char = arrayContent[i];

    if (!inString) {
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        currentElement += char;
      } else if (char === '$' && arrayContent[i + 1] === '{') {
        braceDepth++;
        currentElement += char;
      } else if (char === '}' && braceDepth > 0) {
        braceDepth--;
        currentElement += char;
      } else if (char === ',' && braceDepth === 0) {
        elements.push(currentElement);
        currentElement = '';
      } else {
        currentElement += char;
      }
    } else {
      currentElement += char;
      if (char === stringChar && arrayContent[i - 1] !== '\\') {
        inString = false;
        stringChar = '';
      }
    }
  }

  // Add the last element
  if (currentElement) {
    elements.push(currentElement);
  }

  return elements;
}
