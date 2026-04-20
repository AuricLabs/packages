import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { logger } from '@auriclabs/logger';
import * as glob from 'glob';

import { constructProperties } from './construct-properties';
import { generateRouterFile, type RouterRoute } from './generate-router';

export interface RegisterApiRoutesOptions {
  routesDir?: string;
  variables?: Record<string, unknown>;
  functionArgs?: Omit<sst.aws.FunctionArgs, 'handler'>;
  apiGatewayV2RouteArgs?: sst.aws.ApiGatewayV2RouteArgs;
  pathPrefix?: string;
  /**
   * When true, routes are consolidated into shared Lambda functions grouped
   * by their effective function configuration. Routes with identical function
   * args share a single Lambda via `@middy/http-router`, while routes with
   * API Gateway overrides (e.g. `auth = undefined`) are registered as explicit
   * routes pointing to the same consolidated Lambda.
   *
   * @default false
   */
  consolidate?: boolean;
}

interface ParsedRoute {
  file: string;
  method: string;
  routePath: string;
  handler: string;
  functionArgs: sst.aws.FunctionArgs;
  apiGatewayArgs: sst.aws.ApiGatewayV2RouteArgs;
}

/**
 * Create a stable hash of function args for grouping.
 * Only hashes the serializable parts that affect Lambda configuration.
 */
const hashFunctionArgs = (args: sst.aws.FunctionArgs): string => {
  // JSON.stringify with sorted keys for stable hashing
  const serialized = JSON.stringify(args, Object.keys(args).sort());
  return crypto.createHash('md5').update(serialized).digest('hex').slice(0, 8);
};

/**
 * Scan route handler files and compute their properties.
 */
const scanRoutes = (
  baseDir: string,
  routesDir: string,
  pathPrefix: string,
  variables: Record<string, unknown>,
  defaultFunctionArgs: Omit<sst.aws.FunctionArgs, 'handler'>,
  defaultApiGatewayV2RouteArgs: sst.aws.ApiGatewayV2RouteArgs,
): ParsedRoute[] => {
  const files = glob
    .sync(path.join(baseDir, '/**/{get,post,put,delete,patch}.ts'))
    .map((file) => path.relative(baseDir, file));

  return files.map((file) => {
    const handler = path.join(routesDir, file).replace('.ts', '.handler');
    const method = path.basename(file, '.ts');
    const routePath = file
      .replace(/(^|\/)(get|post|put|delete|patch)\.ts$/, '')
      .replace(/\\/g, '/')
      .replace(/\/index$/, '');

    const { 'api-gateway': apiGatewayArgs, function: functionArgs } = constructProperties(
      baseDir,
      file,
      { ...variables, $app, $dev },
      {
        'api-gateway': defaultApiGatewayV2RouteArgs,
        function: defaultFunctionArgs,
      },
    ) as {
      ['api-gateway']: sst.aws.ApiGatewayV2RouteArgs;
      function: sst.aws.FunctionArgs;
    };

    return { file, method, routePath, handler, functionArgs, apiGatewayArgs };
  });
};

/**
 * Register routes individually (original behavior).
 */
const registerIndividualRoutes = (
  api: sst.aws.ApiGatewayV2,
  routes: ParsedRoute[],
  pathPrefix: string,
  routesDir: string,
): void => {
  routes.forEach(({ file, method, routePath, handler, functionArgs, apiGatewayArgs }) => {
    const route = `${method.toUpperCase()} ${pathPrefix}${routePath ? `/${routePath}` : ''}`;
    logger.debug(`Registering route ${route} from ${routesDir}/${file}`);
    api.route(route, { ...functionArgs, handler }, { ...apiGatewayArgs });
  });
};

/**
 * Check if two objects are deeply equal (for comparing API gateway args).
 */
const isDeepEqual = (a: unknown, b: unknown): boolean => {
  return JSON.stringify(a) === JSON.stringify(b);
};

/**
 * Register routes in consolidated mode — grouped by function config,
 * with a shared Lambda per group via `@middy/http-router`.
 */
const registerConsolidatedRoutes = (
  api: sst.aws.ApiGatewayV2,
  routes: ParsedRoute[],
  pathPrefix: string,
  routesDir: string,
  baseDir: string,
  defaultApiGatewayV2RouteArgs: sst.aws.ApiGatewayV2RouteArgs,
): void => {
  // Group routes by their effective function config hash
  const groups = new Map<string, { functionArgs: sst.aws.FunctionArgs; routes: ParsedRoute[] }>();

  for (const route of routes) {
    const hash = hashFunctionArgs(route.functionArgs);
    let group = groups.get(hash);
    if (!group) {
      group = { functionArgs: route.functionArgs, routes: [] };
      groups.set(hash, group);
    }
    group.routes.push(route);
  }

  for (const [hash, group] of groups) {
    const suffix = groups.size > 1 ? `_${hash}` : '';
    const routerPath = path.join(baseDir, `_router${suffix}.ts`);

    // Separate routes into catch-all eligible and api-gateway override routes
    const catchAllRoutes: ParsedRoute[] = [];
    const overrideRoutes: ParsedRoute[] = [];

    for (const route of group.routes) {
      if (isDeepEqual(route.apiGatewayArgs, defaultApiGatewayV2RouteArgs)) {
        catchAllRoutes.push(route);
      } else {
        overrideRoutes.push(route);
      }
    }

    // Build the router route definitions for catch-all routes
    const routerRoutes: RouterRoute[] = catchAllRoutes.map((r) => ({
      method: r.method,
      routePath: r.routePath,
      handlerFile: path.join(baseDir, r.file),
    }));

    // Also include override routes in the router — they share the same Lambda,
    // just registered with different API Gateway args
    const allRouterRoutes: RouterRoute[] = [
      ...routerRoutes,
      ...overrideRoutes.map((r) => ({
        method: r.method,
        routePath: r.routePath,
        handlerFile: path.join(baseDir, r.file),
      })),
    ];

    // Generate the router file
    const handlerPath = generateRouterFile(routerPath, allRouterRoutes, pathPrefix);

    // Convert absolute handler path to relative from cwd for SST
    const relativeHandlerPath = path.relative(process.cwd(), handlerPath);

    logger.info(
      `Consolidated ${group.routes.length} routes into ${relativeHandlerPath} (${catchAllRoutes.length} standard, ${overrideRoutes.length} override)`,
    );

    // Register every route individually, all pointing to the shared consolidated
    // Lambda. This avoids ANY /{proxy+} catch-all routes which intercept OPTIONS
    // preflight requests and break API Gateway's native CORS auto-handling.
    for (const route of catchAllRoutes) {
      const routeKey = `${route.method.toUpperCase()} ${pathPrefix}${route.routePath ? `/${route.routePath}` : ''}`;
      logger.debug(`Registering route ${routeKey} (consolidated)`);
      api.route(
        routeKey,
        { ...group.functionArgs, handler: relativeHandlerPath },
        { ...defaultApiGatewayV2RouteArgs },
      );
    }

    // Register override routes — same Lambda, different API Gateway args
    for (const route of overrideRoutes) {
      const routeKey = `${route.method.toUpperCase()} ${pathPrefix}${route.routePath ? `/${route.routePath}` : ''}`;
      logger.debug(
        `Registering override route ${routeKey} (consolidated, custom api-gateway args)`,
      );
      api.route(
        routeKey,
        { ...group.functionArgs, handler: relativeHandlerPath },
        { ...route.apiGatewayArgs },
      );
    }
  }
};

/**
 * Register API routes from a directory of handler files.
 *
 * @param api An existing API Gateway V2 API
 * @param options Configuration options
 * @param options.routesDir The directory containing the handler files (relative to pwd)
 * @param options.variables Variables to be used in the properties files
 * @param options.consolidate When true, groups routes by function config into shared Lambdas
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
    consolidate = false,
  }: RegisterApiRoutesOptions,
): sst.aws.ApiGatewayV2 => {
  try {
    const baseDir = path.join(process.cwd(), routesDir);

    if (!fs.existsSync(baseDir)) {
      throw new Error(`API directory ${routesDir} does not exist`);
    }

    const routes = scanRoutes(
      baseDir,
      routesDir,
      pathPrefix,
      variables,
      defaultFunctionArgs,
      defaultApiGatewayV2RouteArgs,
    );

    if (consolidate) {
      registerConsolidatedRoutes(
        api,
        routes,
        pathPrefix,
        routesDir,
        baseDir,
        defaultApiGatewayV2RouteArgs,
      );
    } else {
      registerIndividualRoutes(api, routes, pathPrefix, routesDir);
    }

    return api;
  } catch (error) {
    logger.error({ error }, 'Error registering API routes');
    throw error;
  }
};
