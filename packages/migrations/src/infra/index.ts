import { createRequire } from 'node:module';
import path from 'node:path';

export interface SstProvider {
  aws: {
    Dynamo: typeof sst.aws.Dynamo;
    ApiGatewayV2: typeof sst.aws.ApiGatewayV2;
    StaticSite: typeof sst.aws.StaticSite;
  };
}

export function createTable(sst: SstProvider) {
  return new sst.aws.Dynamo('MigrationsTable', {
    fields: {
      pk: 'string',
      sk: 'string',
      gsi1pk: 'string',
      gsi1sk: 'string',
      gsi2pk: 'string',
      gsi2sk: 'string',
    },
    primaryIndex: {
      hashKey: 'pk',
      rangeKey: 'sk',
    },
    globalIndexes: {
      gsi1: { hashKey: 'gsi1pk', rangeKey: 'gsi1sk' },
      gsi2: { hashKey: 'gsi2pk', rangeKey: 'gsi2sk' },
    },
  });
}

export interface BasicAuthConfig {
  /** Plaintext username — typically wired from an SST secret. */
  username: $util.Input<string>;
  /** Plaintext password — typically wired from an SST secret. */
  password: $util.Input<string>;
  /** Realm shown in browser auth dialog. Defaults to "Migrations Dashboard". */
  realm?: string;
}

export interface DashboardOptions {
  sst: SstProvider;
  table: sst.aws.Dynamo;
  handler: string;
  migrationFn?: sst.aws.Function;
  domain?: sst.aws.StaticSiteArgs['domain'];
  nodejs?: sst.aws.FunctionArgs['nodejs'];
  /**
   * Optional HTTP basic auth gate on the static site. When set, attaches a
   * CloudFront viewer-request function that rejects requests without the
   * matching `Authorization: Basic <base64>` header. Credentials are inlined
   * into the function source at deploy time via Pulumi apply.
   *
   * Note: this only gates the static UI. The API gateway URL remains
   * directly callable — browsers don't auto-send basic auth credentials
   * cross-origin, so the dashboard's fetch() can't carry them. Treat this
   * as discovery-prevention for the dashboard, not API protection.
   */
  auth?: BasicAuthConfig;
}

export function createDashboard(options: DashboardOptions) {
  const { sst } = options;
  const api = new sst.aws.ApiGatewayV2('MigrationsApi', { cors: true });

  const link: unknown[] = [options.table];
  if (options.migrationFn) {
    link.push(options.migrationFn);
  }

  api.route('$default', {
    handler: options.handler,
    link,
    environment: {
      ...(options.migrationFn ? { MIGRATION_FUNCTION_NAME: options.migrationFn.name } : {}),
    },
    nodejs: options.nodejs,
  });

  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve('@auriclabs/migrations/package.json');
  const pkgRoot = path.dirname(pkgJsonPath);
  const uiPath = path.join(pkgRoot, 'ui');
  const uiRelative = path.relative(process.cwd(), uiPath);

  const basicAuthFn = options.auth ? buildBasicAuthFunction(options.auth) : undefined;

  // Copy pre-built dist and inject the API URL at deploy time.
  // The build command copies ui/dist to a temp output dir and injects
  // a script tag that sets window.__MIGRATIONS_API_URL__ before the app loads.
  const site = new sst.aws.StaticSite('Migrations', {
    path: uiRelative,
    build: {
      command: [
        'cp -r dist _deploy',
        `sed -i.bak 's|<head>|<head><script>window.__MIGRATIONS_API_URL__="'$VITE_API_URL'"</script>|' _deploy/index.html`,
        'rm -f _deploy/index.html.bak',
      ].join(' && '),
      output: '_deploy',
    },
    dev: {
      command: 'npx vite dev',
      url: 'http://localhost:3100',
    },
    environment: {
      VITE_API_URL: api.url,
    },
    domain: options.domain,
    ...(basicAuthFn && {
      transform: {
        cdn: (args) => {
          // Merge — don't replace — the existing defaultCacheBehavior. SST
          // populates required fields (targetOriginId, viewerProtocolPolicy,
          // etc.); we only add a viewer-request function association.
          // Pulumi's deeply-optional Input<...> shape vs the nested Output<...>
          // produced by apply() doesn't reconcile in TS, so the assignment is
          // typed as `any`. The runtime shape is correct: it's the existing
          // behavior with one extra functionAssociations entry appended.
          args.defaultCacheBehavior = $output([args.defaultCacheBehavior, basicAuthFn.arn]).apply(
            ([raw, fnArn]) => {
              const behavior = raw as Exclude<typeof raw, string>;
              return {
                ...behavior,
                functionAssociations: [
                  ...(behavior.functionAssociations ?? []),
                  { eventType: 'viewer-request', functionArn: fnArn },
                ],
              };
            },
          ) as unknown as typeof args.defaultCacheBehavior;
        },
      },
    }),
  });

  return { api, site };
}

function buildBasicAuthFunction(auth: BasicAuthConfig) {
  const realm = (auth.realm ?? 'Migrations Dashboard').replace(/"/g, '\\"');

  // Inline the encoded credential into the CloudFront Function source at
  // deploy time. CFFs can't read SSM at runtime, so the credential lives
  // in the deployed function's code (same trust boundary as SST secret
  // state). Rotate by updating the upstream secret and redeploying.
  const code = $output([auth.username, auth.password]).apply(([username, password]) => {
    const encoded = Buffer.from(`${username}:${password}`).toString('base64');
    return [
      'function handler(event) {',
      '  var request = event.request;',
      '  var auth = request.headers.authorization && request.headers.authorization.value;',
      `  if (auth !== "Basic ${encoded}") {`,
      '    return {',
      '      statusCode: 401,',
      '      statusDescription: "Unauthorized",',
      '      headers: {',
      `        "www-authenticate": { value: 'Basic realm="${realm}"' }`,
      '      }',
      '    };',
      '  }',
      '  return request;',
      '}',
    ].join('\n');
  });

  return new aws.cloudfront.Function('MigrationsBasicAuth', {
    runtime: 'cloudfront-js-2.0',
    code,
    comment: 'HTTP basic auth gate for migrations dashboard',
  });
}
