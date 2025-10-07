import fs from 'fs';
import path from 'path';

import * as glob from 'glob';
import { camelCase, upperFirst } from 'lodash-es';

import { constructProperties } from './construct-properties.js';

export interface RegisterFunctionsOptions {
  functionsDir?: string;
  propertiesVariables?: Record<string, unknown>;
  namePrefix?: string;
  nameSuffix?: string;
  functionArgs?: Omit<sst.aws.FunctionArgs, 'handler'>;
  componentOptions?: $util.ComponentResourceOptions;
}

export type FunctionWithName = sst.aws.Function & { sstName: string };

/**
 * Register SST Functions from a directory of index.ts files
 * @param options Configuration options
 * @param options.functionsDir The directory containing the index.ts files (relative to pwd)
 * @param options.propertiesVariables Variables to be used in the properties files
 * @returns Array of all generated SST Functions
 */
export const registerFunctions = ({
  propertiesVariables = {},
  functionsDir = 'functions',
  nameSuffix = 'Fn',
  namePrefix = '',
  functionArgs: additionalFunctionArgs = {},
  componentOptions = {},
}: RegisterFunctionsOptions = {}): FunctionWithName[] => {
  const baseDir = path.join(process.cwd(), functionsDir);

  if (!fs.existsSync(baseDir)) {
    throw new Error(`Functions directory ${functionsDir} does not exist`);
  }

  const files = glob
    .sync(path.join(baseDir, '/*/index.ts'))
    .concat(glob.sync(path.join(baseDir, '/**/*/index.ts')))
    .map((file) => path.relative(baseDir, file));

  const functions: FunctionWithName[] = [];

  files.forEach((file) => {
    const handler = path.join(functionsDir, file).replace('.ts', '.handler');

    // Generate function name from path in title case
    const functionName = generateFunctionName(namePrefix, file, nameSuffix);

    const { function: functionArgs } = constructProperties(baseDir, file, {
      ...propertiesVariables,
      aws,
      $app,
      $dev,
    }) as {
      function: sst.aws.FunctionArgs;
    };

    const fn = new sst.aws.Function(
      functionName,
      {
        ...functionArgs,
        ...additionalFunctionArgs,
        handler,
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        link: $resolve([functionArgs?.link, additionalFunctionArgs?.link].filter(Boolean)).apply(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment
          ([link = [], additionalLink = []]) => [...link, ...additionalLink],
        ),
      },
      {
        ...componentOptions,
      },
    );

    functions.push(Object.assign(fn, { sstName: functionName }));
  });

  return functions;
};

/**
 * Generate a function name from a file path in title case
 * @param filePath The relative file path (e.g., "property/create/index.ts")
 * @returns The function name in title case (e.g., "PropertyCreate")
 */
function generateFunctionName(prefix: string, filePath: string, suffix: string): string {
  // Remove the index.ts part and split by path separators
  const pathWithoutIndex = filePath.replace(/\/index\.ts$/, '');
  const pathParts = pathWithoutIndex.split(path.sep).filter((part) => part.length > 0);

  // Convert each part to title case and join
  return (
    upperFirst(camelCase(prefix)) +
    pathParts.map((part) => upperFirst(camelCase(part))).join('') +
    upperFirst(camelCase(suffix))
  );
}
