import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { logger } from '@auriclabs/logger';
import * as glob from 'glob';

import { constructProperties } from './construct-properties';
import { generateRouterFile, type RouterRoute } from './generate-router';

/**
 * Minimal interface for the `sst` global needed by consolidated mode.
 */
export interface SstProvider {
  aws: {
    Function: new (
      name: string,
      args: Record<string, unknown>,
      opts?: Record<string, unknown>,
    ) => { arn: unknown };
  };
}

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
   * Requires `sst` and `aws` to be provided.
   *
   * @default false
   */
  consolidate?: boolean;
  /**
   * The `sst` global from your SST config context. Required when `consolidate`
   * is true. Used to create the Lambda function via `sst.aws.Function`.
   */
  sst?: SstProvider;
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
  /**
   * Callback fired once per consolidated Lambda group, immediately after the
   * `sst.aws.Function` is created. Receives the resource name and the function
   * reference, so callers can attach extras like provisioned concurrency,
   * alarms, or aliases without forking this module.
   *
   * Only fires in `consolidate: true` mode.
   *
   * If the callback returns `{ qualifierName }`, the API Gateway integration
   * and lambda:InvokeFunction permission both target the qualified ARN
   * (`<fn.arn>:<qualifierName>`) instead of the unqualified `$LATEST`. This is
   * what makes provisioned concurrency on a Lambda alias actually receive
   * traffic — without it the integration calls `$LATEST` and any PC pinned on
   * the alias sits idle.
   *
   * @example
   * ```ts
   * registerApiRoutes(api, {
   *   consolidate: true,
   *   sst,
   *   aws,
   *   functionArgs,
   *   onConsolidatedFunction: (name, fn) => {
   *     const alias = new aws.lambda.Alias(`${name}LiveAlias`, {
   *       functionName: fn.nodes.function.apply((f) => f.name),
   *       functionVersion: fn.nodes.function.apply((f) => f.version),
   *       name: 'live',
   *     });
   *     new aws.lambda.ProvisionedConcurrencyConfig(`${name}PC`, {
   *       functionName: fn.nodes.function.apply((f) => f.name),
   *       qualifier: alias.name,
   *       provisionedConcurrentExecutions: 2,
   *     });
   *     return { qualifierName: alias.name };
   *   },
   * });
   * ```
   */
  onConsolidatedFunction?: (
    name: string,
    fn: sst.aws.Function,
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  ) => void | { qualifierName?: $util.Input<string> };
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
  sstProvider: SstProvider,
  awsProvider: AwsProvider,
  resourcePrefix: string,
  onConsolidatedFunction?: (
    name: string,
    fn: sst.aws.Function,
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  ) => void | { qualifierName?: $util.Input<string> },
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

    // 1. Pre-create the Lambda function via sst.aws.Function (handles bundling, links, etc.)
    const fn = new sstProvider.aws.Function(`${name}Function`, {
      ...group.functionArgs,
      handler: relativeHandlerPath,
    });

    // 1a. Optional caller hook — lets infra attach provisioned concurrency,
    // alarms, etc. to the consolidated function without forking this module.
    // If the hook returns `{ qualifierName }`, the integration + permission
    // below target the qualified ARN so PC on an alias actually receives
    // traffic.
    type HookResult = { qualifierName?: $util.Input<string> } | undefined;
    let qualifierName: $util.Input<string> | undefined;
    if (onConsolidatedFunction) {
      const hook = onConsolidatedFunction as (n: string, f: sst.aws.Function) => HookResult;
      const hookResult = hook(name, fn as unknown as sst.aws.Function);
      if (hookResult?.qualifierName !== undefined) {
        qualifierName = hookResult.qualifierName;
      }
    }
    const fnTarget: $util.Input<string> = qualifierName
      ? ($util.interpolate`${fn.arn}:${qualifierName}` as $util.Input<string>)
      : (fn.arn as $util.Input<string>);

    // 2. Single permission — allows the entire API Gateway to invoke this Lambda
    const executionArn = apiGw.executionArn as unknown as {
      apply: (fn: (v: string) => string) => unknown;
    };
    new awsProvider.lambda.Permission(`${name}Permission`, {
      action: 'lambda:InvokeFunction',
      function: fnTarget,
      principal: 'apigateway.amazonaws.com',
      sourceArn: executionArn.apply((arn: string) => `${arn}/*`),
    });

    // 3. Single integration pointing to the Lambda
    const integration = new awsProvider.apigatewayv2.Integration(`${name}Integration`, {
      apiId: apiGw.id,
      integrationType: 'AWS_PROXY',
      integrationUri: fnTarget,
      payloadFormatVersion: '2.0',
    });

    // 4. Register each route as a Pulumi primitive (no per-route permission)
    const allRoutes = [...catchAllRoutes, ...overrideRoutes];
    for (const route of allRoutes) {
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
        target: (integration.id as { apply: (fn: (v: string) => string) => unknown }).apply(
          (id: string) => `integrations/${id}`,
        ),
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
    sst: sstProvider,
    aws: awsProvider,
    name,
    onConsolidatedFunction,
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
      if (!sstProvider || !awsProvider) {
        throw new Error(
          'The `sst` and `aws` options are required when `consolidate` is true. ' +
            'Pass the sst and aws globals from your SST config context.',
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
        sstProvider,
        awsProvider,
        resourcePrefix,
        onConsolidatedFunction,
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
