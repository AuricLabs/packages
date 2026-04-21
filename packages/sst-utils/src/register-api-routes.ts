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
    const fullPath = pathPrefix + (routePath ? `/${routePath}` : '') || '/';
    const route = `${method.toUpperCase()} ${fullPath}`;
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
 *
 * A single `sst.aws.Function` is pre-created per group, and all routes
 * in that group reference it by ARN. This avoids creating duplicate
 * Lambda + IAM Role + LogGroup resources for every route.
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

    // Build router route definitions (all routes share the same Lambda)
    const allRouterRoutes: RouterRoute[] = [...catchAllRoutes, ...overrideRoutes].map((r) => ({
      method: r.method,
      routePath: r.routePath,
      handlerFile: path.join(baseDir, r.file),
    }));

    // Generate the router file
    const handlerPath = generateRouterFile(routerPath, allRouterRoutes, pathPrefix);

    // Convert absolute handler path to relative from cwd for SST
    const relativeHandlerPath = path.relative(process.cwd(), handlerPath);

    logger.info(
      `Consolidated ${group.routes.length} routes into ${relativeHandlerPath} (${catchAllRoutes.length} standard, ${overrideRoutes.length} override)`,
    );

    // Create the Lambda via the first route, then reuse its ARN for the rest.
    // This keeps resource creation inside SST's api.route() which has access
    // to the sst global, while avoiding duplicate Lambda resources.
    const allRoutes = [...catchAllRoutes, ...overrideRoutes];
    let functionArn: ReturnType<typeof api.route>['nodes']['function']['arn'] | undefined;

    for (const route of allRoutes) {
      const routePath = route.routePath ? `/${route.routePath}` : '';
      const fullPath = pathPrefix + routePath || '/';
      const routeKey = `${route.method.toUpperCase()} ${fullPath}`;
      const apiGwArgs = isDeepEqual(route.apiGatewayArgs, defaultApiGatewayV2RouteArgs)
        ? defaultApiGatewayV2RouteArgs
        : route.apiGatewayArgs;

      if (!functionArn) {
        // First route: create the Lambda
        logger.debug(`Registering route ${routeKey} (consolidated, primary)`);
        const lambdaRoute = api.route(
          routeKey,
          { ...group.functionArgs, handler: relativeHandlerPath },
          { ...apiGwArgs },
        );
        functionArn = lambdaRoute.nodes.function.arn;
      } else {
        // Subsequent routes: reuse the Lambda via ARN
        logger.debug(`Registering route ${routeKey} (consolidated, shared)`);
        api.route(routeKey, functionArn, { ...apiGwArgs });
      }
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
