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

/**
 * A host application owns identity and authorization. The authorizer must be
 * created on this API (authorizer IDs cannot be reused across API Gateways).
 * The bundled UI requests short-lived tokens from a trusted parent window;
 * the host must verify both the request origin and iframe Window source.
 */
export interface JobsDashboardAuthConfig {
  createAuthorizer: (api: sst.aws.ApiGatewayV2) => { id: $util.Input<string> };
  /** Exact HTTPS origin hosting the Jobs static site. */
  siteOrigin: string;
  /** Exact HTTPS origin of the signed-in operator application. */
  parentOrigin: string;
  /** Operator-app URL to open when the Jobs site is visited directly. */
  signInUrl: string;
}

/**
 * The subset of the SST components namespace that {@link createJobsDashboard}
 * needs at runtime.
 *
 * Passed in rather than referenced as the `sst` global for the same reason as
 * {@link JobTableSstProvider}: this package ships as `.mjs`, and SST's config
 * evaluator skips `.mjs`/`.cjs` when injecting the `sst` global (its esbuild
 * `onLoad` plugin filters on `\.(js|ts|jsx|tsx)$`). See the note on
 * {@link JobTableSstProvider} for the full mechanism.
 */
export interface JobsDashboardSstProvider {
  aws: {
    ApiGatewayV2: typeof sst.aws.ApiGatewayV2;
    StaticSite: typeof sst.aws.StaticSite;
  };
}

export interface JobsDashboardOptions {
  /**
   * SST components namespace — pass the injected `sst` global from your
   * `sst.config.ts` (a `.ts` file, which SST *does* inject `sst` into).
   * See {@link JobsDashboardSstProvider}.
   */
  sst: JobsDashboardSstProvider;
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
  /** Required authorization contract for the deployed site and API. */
  auth: JobsDashboardAuthConfig;
  /**
   * Optional HTTP basic auth gate on the static site. When set, injects a
   * basic-auth check into the StaticSite's CloudFront viewer-request
   * function — requests without the matching `Authorization: Basic <base64>`
   * header get a 401 before any routing logic runs. Credentials are inlined
   * into the function source at deploy time via Pulumi apply.
   *
   * Additional discovery gate only. It does not replace `auth`, and callers
   * embedding the UI must ensure it does not block the iframe.
   */
  basicAuth?: JobsDashboardBasicAuthConfig;
}

export function createJobsDashboard(options: JobsDashboardOptions) {
  const { sst } = options;
  if (typeof options.auth.createAuthorizer !== 'function') {
    throw new Error('Jobs dashboard requires an API authorizer');
  }
  assertOrigin(options.auth.siteOrigin, 'siteOrigin');
  assertOrigin(options.auth.parentOrigin, 'parentOrigin');
  const signInUrl = new URL(options.auth.signInUrl);
  if (signInUrl.origin !== options.auth.parentOrigin) {
    throw new Error('Jobs dashboard signInUrl must use parentOrigin');
  }

  const api = new sst.aws.ApiGatewayV2('JobsDashboardApi', {
    cors: {
      allowOrigins: [options.auth.siteOrigin],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type'],
    },
  });
  const authorizer = options.auth.createAuthorizer(api);
  if (!authorizer.id) {
    throw new Error('Jobs dashboard authorizer did not return an ID');
  }

  const link: unknown[] = [options.table, ...(options.link ?? [])];

  api.route(
    '$default',
    { handler: options.apiHandler, link },
    {
      auth: { lambda: authorizer.id },
    },
  );
  // A protected $default route also catches OPTIONS. AWS requires an explicit
  // unprotected, higher-priority route so browser preflights can complete.
  api.route(
    'OPTIONS /{proxy+}',
    { handler: options.apiHandler, link },
    {
      auth: false,
    },
  );

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
        'node scripts/inject-config.mjs',
      ].join(' && '),
      output: '_deploy',
    },
    dev: {
      command: 'npx vite dev',
      url: 'http://localhost:3101',
    },
    environment: {
      JOBS_API_URL: api.url,
      JOBS_AUTH_PARENT_ORIGIN: options.auth.parentOrigin,
      JOBS_AUTH_SIGN_IN_URL: options.auth.signInUrl,
    },
    domain: options.domain,
    edge: {
      ...(basicAuthInjection && { viewerRequest: { injection: basicAuthInjection } }),
      viewerResponse: {
        injection: `event.response.headers["content-security-policy"] = { value: ${JSON.stringify(`frame-ancestors 'self' ${options.auth.parentOrigin}`)} };`,
      },
    },
  });

  return { api, site };
}

function assertOrigin(value: string, name: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Jobs dashboard ${name} must be an exact HTTPS origin`);
  }
  if (
    parsed.origin !== value ||
    parsed.protocol !== 'https:' ||
    !/^[a-zA-Z0-9.-]+$/.test(parsed.hostname)
  ) {
    throw new Error(`Jobs dashboard ${name} must be an exact HTTPS origin`);
  }
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
