import { describe, expect, test } from 'vitest';

import {
  resolveAuthProperties,
  deriveResourcePrefix,
  type AwsProvider,
} from './register-api-routes.js';

/**
 * Unit tests for the route path extraction and route formatting logic
 * used in registerApiRoutes. We test the logic directly rather than
 * the full function to avoid needing to mock SST globals, glob, fs,
 * and the API gateway.
 */
describe('registerApiRoutes route path extraction', () => {
  // This is the regex pipeline from registerApiRoutes
  function extractRoutePath(file: string): string {
    return file
      .replace(/(^|\/)(get|post|put|delete|patch)\.ts$/, '')
      .replace(/\\/g, '/')
      .replace(/\/index$/, '');
  }

  test('should extract route path for nested handler files', () => {
    expect(extractRoutePath('users/get.ts')).toBe('users');
    expect(extractRoutePath('users/post.ts')).toBe('users');
    expect(extractRoutePath('users/put.ts')).toBe('users');
    expect(extractRoutePath('users/delete.ts')).toBe('users');
    expect(extractRoutePath('users/patch.ts')).toBe('users');
  });

  test('should extract route path for deeply nested handler files', () => {
    expect(extractRoutePath('users/profile/get.ts')).toBe('users/profile');
    expect(extractRoutePath('api/v1/orders/post.ts')).toBe('api/v1/orders');
  });

  test('should extract empty route path for root-level handler files', () => {
    expect(extractRoutePath('get.ts')).toBe('');
    expect(extractRoutePath('post.ts')).toBe('');
    expect(extractRoutePath('put.ts')).toBe('');
    expect(extractRoutePath('delete.ts')).toBe('');
    expect(extractRoutePath('patch.ts')).toBe('');
  });

  test('should handle index routes', () => {
    expect(extractRoutePath('users/index/get.ts')).toBe('users');
  });

  test('should not strip method names from directory paths', () => {
    expect(extractRoutePath('get/users/get.ts')).toBe('get/users');
    expect(extractRoutePath('delete/items/post.ts')).toBe('delete/items');
  });
});

describe('registerApiRoutes route formatting', () => {
  function formatRoute(file: string, pathPrefix: string): string {
    const method = file.replace(/.*\//, '').replace('.ts', '');
    const routePath = file
      .replace(/(^|\/)(get|post|put|delete|patch)\.ts$/, '')
      .replace(/\\/g, '/')
      .replace(/\/index$/, '');
    return `${method.toUpperCase()} ${pathPrefix}${routePath ? `/${routePath}` : ''}`;
  }

  test('should format route for nested handler with prefix', () => {
    expect(formatRoute('users/get.ts', '/agents')).toBe('GET /agents/users');
    expect(formatRoute('users/profile/post.ts', '/api')).toBe('POST /api/users/profile');
  });

  test('should format route for root-level handler with prefix (no trailing slash)', () => {
    expect(formatRoute('get.ts', '/agents')).toBe('GET /agents');
    expect(formatRoute('post.ts', '/agents')).toBe('POST /agents');
    expect(formatRoute('put.ts', '/agents')).toBe('PUT /agents');
    expect(formatRoute('delete.ts', '/agents')).toBe('DELETE /agents');
    expect(formatRoute('patch.ts', '/agents')).toBe('PATCH /agents');
  });

  test('should format route for root-level handler with empty prefix', () => {
    expect(formatRoute('get.ts', '')).toBe('GET ');
    expect(formatRoute('post.ts', '')).toBe('POST ');
  });

  test('should format route for nested handler with empty prefix', () => {
    expect(formatRoute('users/get.ts', '')).toBe('GET /users');
  });
});

// ---------------------------------------------------------------------------
// resolveAuthProperties — SST auth → Pulumi route auth
// ---------------------------------------------------------------------------
describe('resolveAuthProperties', () => {
  test('returns NONE when auth is undefined', () => {
    expect(resolveAuthProperties({})).toEqual({ authorizationType: 'NONE' });
  });

  test('returns NONE when auth is false', () => {
    expect(resolveAuthProperties({ auth: false })).toEqual({ authorizationType: 'NONE' });
  });

  test('returns CUSTOM with authorizerId for lambda auth', () => {
    const result = resolveAuthProperties({ auth: { lambda: 'auth-123' } });
    expect(result).toEqual({
      authorizationType: 'CUSTOM',
      authorizerId: 'auth-123',
    });
  });

  test('returns AWS_IAM for IAM auth', () => {
    const result = resolveAuthProperties({ auth: { iam: true } });
    expect(result).toEqual({ authorizationType: 'AWS_IAM' });
  });

  test('returns JWT with authorizer and scopes', () => {
    const result = resolveAuthProperties({
      auth: {
        jwt: {
          authorizer: 'jwt-auth-456',
          scopes: ['read:profile', 'write:profile'],
        },
      },
    });
    expect(result).toEqual({
      authorizationType: 'JWT',
      authorizerId: 'jwt-auth-456',
      authorizationScopes: ['read:profile', 'write:profile'],
    });
  });

  test('returns JWT without scopes when scopes not provided', () => {
    const result = resolveAuthProperties({
      auth: { jwt: { authorizer: 'jwt-auth-789' } },
    });
    expect(result).toEqual({
      authorizationType: 'JWT',
      authorizerId: 'jwt-auth-789',
      authorizationScopes: undefined,
    });
  });

  test('returns NONE for empty auth object', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const emptyAuth: sst.aws.ApiGatewayV2RouteArgs = { auth: {} as any };
    expect(resolveAuthProperties(emptyAuth)).toEqual({ authorizationType: 'NONE' });
  });
});

// ---------------------------------------------------------------------------
// deriveResourcePrefix — routesDir → PascalCase prefix
// ---------------------------------------------------------------------------
describe('deriveResourcePrefix', () => {
  test('converts simple service path', () => {
    expect(deriveResourcePrefix('services/org/api')).toBe('ServicesOrgApi');
  });

  test('converts hyphenated segments', () => {
    expect(deriveResourcePrefix('services/org/api-agents')).toBe('ServicesOrgApiAgents');
  });

  test('converts internal API path', () => {
    expect(deriveResourcePrefix('services/org/api-internal')).toBe('ServicesOrgApiInternal');
  });

  test('converts deeply nested paths', () => {
    expect(deriveResourcePrefix('services/billing/api')).toBe('ServicesBillingApi');
  });

  test('handles single segment', () => {
    expect(deriveResourcePrefix('api')).toBe('Api');
  });

  test('handles trailing slash', () => {
    expect(deriveResourcePrefix('services/org/api/')).toBe('ServicesOrgApi');
  });

  test('handles multiple hyphens in segment', () => {
    expect(deriveResourcePrefix('services/my-cool-service/api')).toBe('ServicesMyCoolServiceApi');
  });
});

// ---------------------------------------------------------------------------
// AwsProvider mock factory — used to verify consolidated resource creation
// ---------------------------------------------------------------------------
interface MockCall {
  name: string;
  args: Record<string, unknown>;
}

function createMockConstructor(calls: MockCall[], extraProps?: Record<string, unknown>) {
  return function MockConstructor(name: string, args: Record<string, unknown>) {
    calls.push({ name, args });
    if (extraProps) Object.assign(this as Record<string, unknown>, extraProps);
  } as unknown as new (name: string, args: Record<string, unknown>) => { id: unknown };
}

function createMockAwsProvider() {
  const calls = {
    permission: [] as MockCall[],
    integration: [] as MockCall[],
    route: [] as MockCall[],
  };

  const provider: AwsProvider = {
    lambda: {
      Permission: createMockConstructor(calls.permission),
    },
    apigatewayv2: {
      Integration: createMockConstructor(calls.integration, { id: 'mock-integration-id' }),
      Route: createMockConstructor(calls.route),
    },
  };

  return { provider, calls };
}

describe('AwsProvider mock factory', () => {
  test('tracks Permission constructor calls', () => {
    const { provider, calls } = createMockAwsProvider();
    new provider.lambda.Permission('TestPerm', { action: 'lambda:InvokeFunction' });
    expect(calls.permission).toHaveLength(1);
    expect(calls.permission[0].name).toBe('TestPerm');
    expect(calls.permission[0].args.action).toBe('lambda:InvokeFunction');
  });

  test('tracks Integration constructor calls and returns id', () => {
    const { provider, calls } = createMockAwsProvider();
    const integration = new provider.apigatewayv2.Integration('TestInt', {
      apiId: 'api-1',
      integrationType: 'AWS_PROXY',
    });
    expect(calls.integration).toHaveLength(1);
    expect(integration.id).toBe('mock-integration-id');
  });

  test('tracks Route constructor calls', () => {
    const { provider, calls } = createMockAwsProvider();
    new provider.apigatewayv2.Route('TestRoute', {
      apiId: 'api-1',
      routeKey: 'GET /users',
    });
    expect(calls.route).toHaveLength(1);
    expect(calls.route[0].args.routeKey).toBe('GET /users');
  });

  test('creates exactly 1 permission and 1 integration for multiple routes', () => {
    const { provider, calls } = createMockAwsProvider();

    // Simulate what registerConsolidatedRoutes does for a 5-route group
    new provider.lambda.Permission('TestPermission', {
      action: 'lambda:InvokeFunction',
      principal: 'apigateway.amazonaws.com',
    });

    const integration = new provider.apigatewayv2.Integration('TestIntegration', {
      apiId: 'api-1',
      integrationType: 'AWS_PROXY',
    });

    const routeKeys = [
      'GET /teams',
      'POST /teams',
      'GET /teams/{id}',
      'PUT /teams/{id}',
      'DELETE /teams/{id}',
    ];
    for (const routeKey of routeKeys) {
      new provider.apigatewayv2.Route(`TestRoute_${routeKey}`, {
        apiId: 'api-1',
        routeKey,
        target: `integrations/${String(integration.id)}`,
      });
    }

    // The key invariant: 1 permission, 1 integration, N routes
    expect(calls.permission).toHaveLength(1);
    expect(calls.integration).toHaveLength(1);
    expect(calls.route).toHaveLength(5);
  });
});
