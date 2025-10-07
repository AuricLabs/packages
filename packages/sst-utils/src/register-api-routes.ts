import fs from 'fs';
import path from 'path';

import { logger } from '@auriclabs/logger';
import * as glob from 'glob';

import { constructProperties } from './construct-properties';

export interface RegisterApiRoutesOptions {
  routesDir?: string;
  variables?: Record<string, unknown>;
  functionArgs?: Omit<sst.aws.FunctionArgs, 'handler'>;
  apiGatewayV2RouteArgs?: sst.aws.ApiGatewayV2RouteArgs;
  pathPrefix?: string;
}

/**
 * Register API routes from a directory of handler files
 * @param api An existing API Gateway V2 API
 * @param options Configuration options
 * @param options.routesDir The directory containing the handler files (relative to pwd)
 * @param options.variables Variables to be used in the properties files
 * @returns The API Gateway V2 API with routes registered
 */
export const registerApiRoutes = (
  api: sst.aws.ApiGatewayV2,
  {
    variables = {},
    routesDir = 'api',
    pathPrefix = '',
    functionArgs: defaultFunctionArgs = {},
    apiGatewayV2RouteArgs: defaultApiGatewayV2RouteArgs = {},
  }: RegisterApiRoutesOptions,
): sst.aws.ApiGatewayV2 => {
  try {
    const baseDir = path.join(process.cwd(), routesDir);

    if (!fs.existsSync(baseDir)) {
      throw new Error(`API directory ${routesDir} does not exist`);
    }

    const files = glob
      .sync(path.join(baseDir, '/**/{get,post,put,delete,patch}.ts'))
      .map((file) => path.relative(baseDir, file));

    files.forEach((file) => {
      const handler = path.join(routesDir, file).replace('.ts', '.handler');

      // Extract the HTTP method from the file name
      const method = path.basename(file, '.ts');

      // Extract the route path from the file path
      // This removes the method part and converts the file path to an API route
      const routePath = file
        .replace(/\/(get|post|put|delete|patch)\.ts$/, '') // Remove the method filename
        .replace(/\\/g, '/') // Normalize backslashes to forward slashes for Windows
        .replace(/\/index$/, ''); // Convert /index to / for root routes

      // Format the route with the HTTP method and path
      const route = `${method.toUpperCase()} ${pathPrefix}/${routePath}`;

      logger.debug(`Registering route ${route} from ${routesDir}/${file}`);

      const { 'api-gateway': apiGatewayArgs, function: functionArgs } = constructProperties(
        baseDir,
        file,
        {
          ...variables,
          aws,
          $app,
          $dev,
        },
        {
          'api-gateway': defaultApiGatewayV2RouteArgs,
          function: defaultFunctionArgs,
        },
      ) as {
        ['api-gateway']: sst.aws.ApiGatewayV2RouteArgs;
        function: sst.aws.FunctionArgs;
      };

      api.route(
        route,
        {
          ...functionArgs,
          handler,
        },
        {
          ...apiGatewayArgs,
        },
      );
    });

    return api;
  } catch (error) {
    logger.error({ error }, 'Error registering API routes');
    throw error;
  }
};
