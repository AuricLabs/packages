import fs from 'fs';
import path from 'path';

import { logger } from '@auriclabs/logger';
import * as glob from 'glob';

import { constructProperties } from './construct-properties';
import { sstCase } from './sst-case';

export interface RegisterFunctionsOptions {
  functionsDir?: string;
  variables?: Record<string, unknown>;
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
 * @param options.variables Variables to be used in the properties files
 * @returns Array of all generated SST Functions
 */
export const registerFunctions = ({
  variables = {},
  functionsDir = 'functions',
  nameSuffix = 'Fn',
  namePrefix = '',
  functionArgs: defaultFunctionArgs = {},
  componentOptions = {},
}: RegisterFunctionsOptions = {}): FunctionWithName[] => {
  try {
    const baseDir = path.join(process.cwd(), functionsDir);

    if (!fs.existsSync(baseDir)) {
      throw new Error(`Functions directory ${functionsDir} does not exist`);
    }

    const files = glob
      .sync(path.join(baseDir, '/**/*/index.ts'))
      .map((file) => path.relative(baseDir, file));

    const functions: FunctionWithName[] = [];

    files.forEach((file) => {
      const handler = path.join(functionsDir, file).replace('.ts', '.handler');

      // Generate function name from path in title case
      const functionName = generateFunctionName(namePrefix, file, nameSuffix);
      logger.debug(`Registering function ${functionName} from ${functionsDir}/${file}`);

      const { function: functionArgs } = constructProperties(
        baseDir,
        file,
        {
          ...variables,
          aws,
          $app,
          $dev,
        },
        {
          function: defaultFunctionArgs,
        },
      ) as {
        function: sst.aws.FunctionArgs;
      };

      const fn = new sst.aws.Function(
        functionName,
        {
          ...functionArgs,
          handler,
        },
        {
          ...componentOptions,
        },
      );

      functions.push(Object.assign(fn, { sstName: functionName }));
    });

    return functions;
  } catch (error) {
    logger.error({ error }, 'Error registering functions');
    throw error;
  }
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
  return sstCase(prefix) + pathParts.map((part) => sstCase(part)).join('') + sstCase(suffix);
}
