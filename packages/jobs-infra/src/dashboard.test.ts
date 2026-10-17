import { describe, expect, it, vi } from 'vitest';

import { createJobsDashboard, type JobsDashboardOptions } from './dashboard';

function fixture() {
  const routes: { key: string; args: unknown }[] = [];
  let apiArgs: unknown;
  let siteArgs: unknown;
  class ApiGatewayV2 {
    constructor(_name: string, args: unknown) {
      apiArgs = args;
    }
    route(key: string, _handler: unknown, args: unknown) {
      routes.push({ key, args });
    }
  }
  class StaticSite {
    readonly args: unknown;
    constructor(_name: string, args: unknown) {
      this.args = args;
      siteArgs = args;
    }
  }
  const createAuthorizer = vi.fn(() => ({ id: 'jobs-admin-authorizer' }));
  const options = {
    sst: { aws: { ApiGatewayV2, StaticSite } },
    table: {},
    apiHandler: 'services/jobs/dashboard.handler',
    uiPath: '/tmp/jobs-ui',
    auth: {
      createAuthorizer,
      siteOrigin: 'https://jobs.example.test',
      parentOrigin: 'https://admin.example.test',
      signInUrl: 'https://admin.example.test/jobs',
    },
  } as unknown as JobsDashboardOptions;
  return {
    options,
    routes,
    createAuthorizer,
    getApiArgs: () => apiArgs,
    getSiteArgs: () => siteArgs,
  };
}

describe('createJobsDashboard', () => {
  it('requires an authorizer on its own API and an exact-origin browser boundary', () => {
    const f = fixture();
    createJobsDashboard(f.options);

    expect(f.createAuthorizer).toHaveBeenCalledWith(expect.any(Object));
    expect(f.getApiArgs()).toEqual({
      cors: {
        allowOrigins: ['https://jobs.example.test'],
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });
    expect(f.routes).toEqual([
      { key: '$default', args: { auth: { lambda: 'jobs-admin-authorizer' } } },
      { key: 'OPTIONS /{proxy+}', args: { auth: false } },
    ]);
    expect(f.getSiteArgs()).toMatchObject({
      edge: {
        viewerResponse: {},
      },
      environment: {
        JOBS_AUTH_PARENT_ORIGIN: 'https://admin.example.test',
        JOBS_AUTH_SIGN_IN_URL: 'https://admin.example.test/jobs',
      },
    });
    const site = f.getSiteArgs() as { edge: { viewerResponse: { injection: string } } };
    expect(site.edge.viewerResponse.injection).toContain(
      "frame-ancestors 'self' https://admin.example.test",
    );
  });

  it('rejects absent authorizer or a wrong-origin sign-in URL', () => {
    const missing = fixture();
    missing.options.auth.createAuthorizer = undefined as never;
    expect(() => createJobsDashboard(missing.options)).toThrow('requires an API authorizer');

    const wrongOrigin = fixture();
    wrongOrigin.options.auth.signInUrl = 'https://other.example.test/jobs';
    expect(() => createJobsDashboard(wrongOrigin.options)).toThrow('must use parentOrigin');
  });

  it('rejects wildcard, HTTP, and path-bearing origins', () => {
    for (const origin of [
      '*',
      'http://jobs.example.test',
      'https://jobs.example.test/path',
      'https://bad"origin.example.test',
    ]) {
      const f = fixture();
      f.options.auth.siteOrigin = origin;
      expect(() => createJobsDashboard(f.options)).toThrow('exact HTTPS origin');
    }
  });
});
