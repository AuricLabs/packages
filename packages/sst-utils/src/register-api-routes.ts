import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { logger } from '@auriclabs/logger';
import * as glob from 'glob';

import { constructProperties } from './construct-properties';
import { generateRouterFile, type RouterRoute } from './generate-router';

/**
 * Minimal interface for the `@pulumi/aws` classes needed by consolidated mode.
 * Pass the `aws` global from your SST config context.
 */
export interface AwsProvider {
  lambda: {
    Permission: new (
      name: string,
      args: Record<string, unknown>,
      opts?: Record<string, unknown>,
    ) => unknown;
  };
  apigatewayv2: {
    Integration: new (
      name: string,
      args: Record<string, unknown>,
      opts?: Record<string, unknown>,
    ) => { id: unknown };
    Route: new (
      name: string,
      args: Record<string, unknown>,
      opts?: Record<string, unknown>,
    ) => unknown;
  };
}

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
   * Requires `aws` to be provided.
   *
   * @default false
   */
  consolidate?: boolean;
  /**
   * The `@pulumi/aws` provider instance. Required when `consolidate` is true.
   * Used to create Pulumi primitives (Permission, Integration, Route) instead
   * of SST's `api.route()` which creates a separate `lambda:Permission` per route,
   * causing AWS's 20KB resource policy limit to be exceeded on services with many routes.
   */
  aws?: AwsProvider;
  /**
   * Resource name prefix for consolidated Lambdas. When omitted, auto-derived
   * from `routesDir` in PascalCase (e.g. `"services/org/api"` → `"ServicesOrgApi"`).
   *
   * @example "OrgApi"
   */
  name?: string;
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
 * Convert SST auth args to Pulumi Route auth properties.
 */
export const resolveAuthProperties = (
  apiGatewayArgs: sst.aws.ApiGatewayV2RouteArgs,
): Record<string, unknown> => {
  const auth = apiGatewayArgs.auth;
  if (!auth || auth === false) return { authorizationType: 'NONE' };

  const a = auth as Record<string, unknown>;
  if (a.iam) return { authorizationType: 'AWS_IAM' };
  if (a.lambda) return { authorizationType: 'CUSTOM', authorizerId: a.lambda };
  if (a.jwt) {
    const jwt = a.jwt as Record<string, unknown>;
    return {
      authorizationType: 'JWT',
      authorizerId: jwt.authorizer,
      authorizationScopes: jwt.scopes,
    };
  }
  return { authorizationType: 'NONE' };
};

/**
 * Derive a PascalCase resource name prefix from a routesDir path.
 *
 * @example deriveResourcePrefix("services/org/api") => "ServicesOrgApi"
 * @example deriveResourcePrefix("services/org/api-agents") => "ServicesOrgApiAgents"
 */
export const deriveResourcePrefix = (routesDir: string): string => {
  return routesDir
    .split(/[/\\]/)
    .filter(Boolean)
    .map((segment) =>
      segment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(''),
    )
    .join('');
};

/**
 * Register routes in consolidated mode — grouped by function config,
 * with a shared Lambda per group via `@middy/http-router`.
 *
 * Pre-creates an `sst.aws.Function` per group, then wires up a single
 * `aws.lambda.Permission`, a single `aws.apigatewayv2.Integration`, and
 * individual `aws.apigatewayv2.Route` primitives. This avoids the
 * per-route `lambda:Permission` that SST's `api.route()` creates, which
 * can exceed AWS's 20KB resource policy limit on services with many routes.
 */
const registerConsolidatedRoutes = (
  api: sst.aws.ApiGatewayV2,
  routes: ParsedRoute[],
  pathPrefix: string,
  routesDir: string,
  baseDir: string,
  defaultApiGatewayV2RouteArgs: sst.aws.ApiGatewayV2RouteArgs,
  awsProvider: AwsProvider,
  resourcePrefix: string,
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

  // Access the underlying API Gateway resource for IDs
  const apiGw = api.nodes.api;

  for (const [hash, group] of groups) {
    const suffix = groups.size > 1 ? `_${hash}` : '';
    const routerPath = path.join(baseDir, `_router${suffix}.ts`);
    const name = `${resourcePrefix}${suffix}`;

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

    // 1. Use api.route() for the FIRST route — this creates the Lambda function
    //    (with bundling, links, etc.), one Permission, one Integration, and one Route.
    //    Then use aws primitives for remaining routes (no extra permissions).
    const allRoutes = [...catchAllRoutes, ...overrideRoutes];
    const [firstRoute, ...remainingRoutes] = allRoutes;

    const firstRoutePath = firstRoute.routePath ? `/${firstRoute.routePath}` : '';
    const firstFullPath = pathPrefix + firstRoutePath || '/';
    const firstRouteKey = `${firstRoute.method.toUpperCase()} ${firstFullPath}`;
    const firstApiGwArgs = isDeepEqual(firstRoute.apiGatewayArgs, defaultApiGatewayV2RouteArgs)
      ? defaultApiGatewayV2RouteArgs
      : firstRoute.apiGatewayArgs;

    logger.debug(`Registering route ${firstRouteKey} (consolidated, primary)`);
    const lambdaRoute = api.route(
      firstRouteKey,
      { ...group.functionArgs, handler: relativeHandlerPath },
      { ...firstApiGwArgs },
    );

    // 2. Reuse the integration from the first route for all remaining routes.
    //    This avoids creating additional lambda:Permissions (SST's api.route()
    //    creates one per call, which exceeds AWS's 20KB policy limit).
    const integrationId = lambdaRoute.nodes.integration.id;

    for (const route of remainingRoutes) {
      const routePath = route.routePath ? `/${route.routePath}` : '';
      const fullPath = pathPrefix + routePath || '/';
      const routeKey = `${route.method.toUpperCase()} ${fullPath}`;
      const routeHash = hashFunctionArgs({ r: routeKey } as unknown as sst.aws.FunctionArgs).slice(
        0,
        6,
      );

      const apiGwArgs = isDeepEqual(route.apiGatewayArgs, defaultApiGatewayV2RouteArgs)
        ? defaultApiGatewayV2RouteArgs
        : route.apiGatewayArgs;
      const authProps = resolveAuthProperties(apiGwArgs);

      logger.debug(`Registering route ${routeKey} (consolidated, primitive)`);
      new awsProvider.apigatewayv2.Route(`${name}Route${routeHash}`, {
        apiId: apiGw.id,
        routeKey,
        target: integrationId.apply((id: string) => `integrations/${id}`),
        ...authProps,
      });
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
    aws: awsProvider,
    name,
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
      if (!awsProvider) {
        throw new Error(
          'The `aws` option is required when `consolidate` is true. ' +
            'Pass the @pulumi/aws instance from your SST config context.',
        );
      }
      const resourcePrefix = name ?? deriveResourcePrefix(routesDir);
      registerConsolidatedRoutes(
        api,
        routes,
        pathPrefix,
        routesDir,
        baseDir,
        defaultApiGatewayV2RouteArgs,
        awsProvider,
        resourcePrefix,
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
