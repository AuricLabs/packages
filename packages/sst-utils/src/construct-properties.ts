import fs from 'fs';
import path from 'path';

import { isObject, cloneDeepWith, get, set, unset } from 'lodash-es';
import propertiesReader from 'properties-reader';
/**
 * Constructs properties from a given base directory and file path,
 * merging properties from multiple levels of nested files and folders.
 *
 * @param baseDir - The base directory path
 * @param filePath - The file path to construct properties from
 * @param variables - The property variables to use for variable substitution
 * @returns The constructed properties
 */
export const constructProperties = (
  baseDir: string,
  filePath: string,
  variables: Record<string, unknown>,
  defaultProperties: Record<string, unknown> = {},
): Record<string, unknown> => {
  // we need to loop through all folders relative to baseDir to file path.
  // if there is a {folder}.properties file next to the folder it should apply to the folder itself.
  // if there is a {folder}/index.properties it should apply to the folder itself.
  // this should happen recursively for each deep folder.
  // if there is a file (ex: post.ts) properties file, it should apply only for that file. {filename}.properties
  // this should combine the entire properties with the deeper ones overriding the previous ones.
  // we then need to create an object, based on the key values of the properties file. For example:
  //   if there is a key called "test.a" with a value of "123", we need to create an object called "test" with a property "a" with a value of "123"
  //   if there is a key called "test.b" with a value of "${userPool.id}", we need to create an object called "test" with a property "b" with a value of the variables.userPool.id

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result: Record<string, unknown> = cloneDeepWith(defaultProperties, (value) => {
    if (isObject(value) && value.constructor === Object) {
      return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value;
  });

  // Check for index.properties at the base level
  const baseIndexPropertiesPath = path.join(baseDir, 'index.properties');
  if (fs.existsSync(baseIndexPropertiesPath)) {
    applyPropertiesFile(baseIndexPropertiesPath, variables, result);
  }

  // Split the relative path into parts
  const parts = filePath.split(path.sep);

  // We'll collect properties from each level
  let currentPath = baseDir;

  // Process all folders in the path
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isFile = i === parts.length - 1;

    // Check for properties file next to the folder
    const folderPropertiesPath = path.join(currentPath, `${part}.properties`);
    if (fs.existsSync(folderPropertiesPath)) {
      applyPropertiesFile(folderPropertiesPath, variables, result);
    }

    // Update current path
    currentPath = path.join(currentPath, part);

    // Check for index.properties inside the folder (except for the last part if it's a file)
    if (!isFile) {
      const indexPropertiesPath = path.join(currentPath, 'index.properties');
      if (fs.existsSync(indexPropertiesPath)) {
        applyPropertiesFile(indexPropertiesPath, variables, result);
      }
    }
  }

  // Check for the file-specific properties
  const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
  const filePropertiesPath = path.join(
    baseDir,
    path.dirname(filePath),
    `${fileNameWithoutExt}.properties`,
  );
  if (fs.existsSync(filePropertiesPath)) {
    applyPropertiesFile(filePropertiesPath, variables, result);
  }

  return result;
};

/**
 * Parses a properties file and returns an object with nested properties
 */
function applyPropertiesFile(
  filePath: string,
  variables: Record<string, unknown>,
  result: Record<string, unknown>,
): void {
  const reader = propertiesReader(filePath);
  const properties = Object.fromEntries(
    Object.entries(reader.getAllProperties()).map(([key]) => {
      return [key, reader.get(key)];
    }),
  );
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === 'string') {
      // Process the value - check if it contains variable references
      const processedValue = processValue(value, variables);

      if (value === 'null') {
        set(result, key, null);
      } else if (value === 'undefined') {
        unset(result, key);
      } else if (key.endsWith('[]')) {
        const arrayObject: unknown[] = get(result, key.slice(0, -2), []) as unknown[];
        arrayObject.push(processedValue);
        set(result, key.slice(0, -2), arrayObject);
        console.log(result);
      } else {
        set(result, key, processedValue);
      }
    } else {
      set(result, key, value);
    }
  }
}

/**
 * Process a property value, replacing ${variable} references with actual values
 */
function processValue(value: string, variables: Record<string, unknown>): unknown {
  // Check if value is an array like [item1,item2,item3]
  const arrayMatch = /^\[(.*)\]$/.exec(value);
  if (arrayMatch) {
    const arrayContent = arrayMatch[1];
    if (arrayContent.trim() === '') {
      return [];
    }

    // Split by comma, but be careful about commas inside variable references
    const elements = parseArrayElements(arrayContent);
    return elements.map((element) => processValue(element.trim(), variables));
  }

  // Check if value is a variable reference like ${userPool.id}
  const variableMatch = /^\${([^{}]+)}$/.exec(value);

  if (variableMatch) {
    const propertyPath = variableMatch[1];
    // Use lodash get to retrieve the nested property
    const resolvedValue = resolveVariable(propertyPath, variables);

    if (resolvedValue === undefined) {
      throw new Error(`Property ${propertyPath} not found in variables`);
    }

    return resolvedValue;
  }

  // it should also check if the string contains a ${variable} and if so, it should return the value of the variable concatenated with the rest of the string
  // it should support multiple variables in a string as well.
  const variableMatches = value.match(/\${([^{}]+?)}/g);
  if (variableMatches) {
    const templateStrings: string[] = [value];
    const values: unknown[] = [];

    for (const match of variableMatches) {
      const propertyPath = match.slice(2, -1);
      const resolvedValue = resolveVariable(propertyPath, variables);

      if (resolvedValue === undefined) {
        throw new Error(`Property ${propertyPath} not found in variables`);
      }

      const slice = templateStrings.pop()?.split(match) ?? [];
      templateStrings.push(slice.shift() ?? '');
      values.push(resolvedValue);
      templateStrings.push(slice.join(match));
    }

    return $interpolate(
      Object.assign(templateStrings, { raw: templateStrings.concat() }),
      ...values,
    );
  }

  return value;
}

/**
 * Parse array elements from a string, respecting variable references
 * Handles commas inside ${variable} references properly
 */
function parseArrayElements(arrayContent: string): string[] {
  const elements: string[] = [];
  let currentElement = '';
  let braceDepth = 0;

  for (let i = 0; i < arrayContent.length; i++) {
    const char = arrayContent[i];

    if (char === '$' && arrayContent[i + 1] === '{') {
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
  }

  // Add the last element
  if (currentElement) {
    elements.push(currentElement);
  }

  return elements;
}

function resolveVariable(path: string, variables: Record<string, unknown>): unknown {
  try {
    // Create a function that has access to the variables object
    // This is a safer alternative to direct eval
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const evalInContext = new Function('variables', `return variables.${path}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return evalInContext(variables);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Error evaluating "${path}": ${errorMessage}`);
  }
}
