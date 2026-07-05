import { createRequire } from 'node:module';
import path from 'node:path';

export interface JobsDashboardBasicAuthConfig {
  /** Plaintext username — typically wired from an SST secret. */
  username: $util.Input<string>;
  /** Plaintext password — typically wired from an SST secret. */
  password: $util.Input<string>;
  /** Realm shown in browser auth dialog. Defaults to "Jobs Dashboard". */
  realm?: string;
}

export interface JobsDashboardOptions {
  /**
   * Handler path for the dashboard API Lambda. The handler should call
   * `initJobs({ tableName: Resource.<JobTable>.name })` and export
   * `createJobsDashboardApiHandler()` from `@auriclabs/jobs`.
   */
  apiHandler: string;
  /** Job table — linked into the API function. */
  table: sst.aws.Dynamo;
  /** Extra linkables for the API function (beyond the table). */
  link?: unknown[];
  domain?: sst.aws.StaticSiteArgs['domain'];
  /**
   * Override the path to the `@auriclabs/jobs` package's `ui/` directory.
   * Defaults to resolving the installed package via `require.resolve`.
   */
  uiPath?: string;
  /**
   * Optional HTTP basic auth gate on the static site. When set, injects a
   * basic-auth check into the StaticSite's CloudFront viewer-request
   * function — requests without the matching `Authorization: Basic <base64>`
   * header get a 401 before any routing logic runs. Credentials are inlined
   * into the function source at deploy time via Pulumi apply.
   *
   * Note: this only gates the static UI. The API gateway URL remains
   * directly callable — browsers don't auto-send basic auth credentials
   * cross-origin, so the dashboard's fetch() can't carry them. Treat this
   * as discovery-prevention for the dashboard, not API protection.
   */
  basicAuth?: JobsDashboardBasicAuthConfig;
}

export function createJobsDashboard(options: JobsDashboardOptions) {
  const api = new sst.aws.ApiGatewayV2('JobsDashboardApi', { cors: true });

  const link: unknown[] = [options.table, ...(options.link ?? [])];

  api.route('$default', {
    handler: options.apiHandler,
    link,
  });

  const uiPath = options.uiPath ?? resolveJobsUiPath();
  const uiRelative = path.relative(process.cwd(), uiPath);

  const basicAuthInjection = options.basicAuth
    ? buildBasicAuthInjection(options.basicAuth)
    : undefined;

  // Copy pre-built dist and inject the API URL at deploy time.
  // The build command copies ui/dist to a temp output dir and injects
  // a script tag that sets globalThis.__JOBS_API_URL__ before the app loads.
  const site = new sst.aws.StaticSite('JobsDashboard', {
    path: uiRelative,
    build: {
      command: [
        // _deploy persists in node_modules across deploys — a stale copy would
        // nest the new dist and keep serving the old bundle
        'rm -rf _deploy',
        'cp -r dist _deploy',
        `sed -i.bak 's|<head>|<head><script>globalThis.__JOBS_API_URL__="'$VITE_API_URL'"</script>|' _deploy/index.html`,
        'rm -f _deploy/index.html.bak',
      ].join(' && '),
      output: '_deploy',
    },
    dev: {
      command: 'npx vite dev',
      url: 'http://localhost:3101',
    },
    environment: {
      VITE_API_URL: api.url,
    },
    domain: options.domain,
    ...(basicAuthInjection && {
      edge: {
        viewerRequest: { injection: basicAuthInjection },
      },
    }),
  });

  return { api, site };
}

/**
 * Resolve the `@auriclabs/jobs` package's `ui/` directory. jobs-infra is a
 * separate package, so the UI ships with `@auriclabs/jobs` — resolve it
 * through the consumer's node_modules (the workspace link covers local dev).
 */
function resolveJobsUiPath(): string {
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve('@auriclabs/jobs/package.json');
  const pkgRoot = path.dirname(pkgJsonPath);
  return path.join(pkgRoot, 'ui');
}

function buildBasicAuthInjection(auth: JobsDashboardBasicAuthConfig) {
  const realm = (auth.realm ?? 'Jobs Dashboard').replace(/"/g, '\\"');

  // Inline the encoded credential into the CloudFront Function source at
  // deploy time. CFFs can't read SSM at runtime, so the credential lives
  // in the deployed function's code (same trust boundary as SST secret
  // state). Rotate by updating the upstream secret and redeploying.
  //
  // Returned as an injection string that SST splices into the start of
  // its existing `cloudfront-js-2.0` viewer-request handler — a 401
  // return short-circuits the rest of the routing logic.
  return $output([auth.username, auth.password]).apply(([username, password]) => {
    const encoded = Buffer.from(`${username}:${password}`).toString('base64');
    return [
      'var __auth = event.request.headers.authorization && event.request.headers.authorization.value;',
      `if (__auth !== "Basic ${encoded}") {`,
      '  return {',
      '    statusCode: 401,',
      '    statusDescription: "Unauthorized",',
      '    headers: {',
      `      "www-authenticate": { value: 'Basic realm="${realm}"' }`,
      '    }',
      '  };',
      '}',
    ].join('\n');
  });
}
