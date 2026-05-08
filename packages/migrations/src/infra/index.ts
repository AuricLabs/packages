import { createRequire } from 'node:module';
import path from 'node:path';

export interface SstProvider {
  aws: {
    Dynamo: typeof sst.aws.Dynamo;
    ApiGatewayV2: typeof sst.aws.ApiGatewayV2;
    StaticSite: typeof sst.aws.StaticSite;
    Vpc?: typeof sst.aws.Vpc;
    Cluster?: typeof sst.aws.Cluster;
    Task?: typeof sst.aws.Task;
  };
}

export interface FargateRunnerSstProvider {
  aws: {
    Vpc: typeof sst.aws.Vpc;
    Cluster: typeof sst.aws.Cluster;
    Task: typeof sst.aws.Task;
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

  const basicAuthInjection = options.auth ? buildBasicAuthInjection(options.auth) : undefined;

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
    ...(basicAuthInjection && {
      edge: {
        viewerRequest: { injection: basicAuthInjection },
      },
    }),
  });

  return { api, site };
}

/**
 * Options for `createFargateRunner` — provisions the VPC, ECS cluster, and
 * one-shot Fargate Task that runs migrations to completion outside of Lambda.
 *
 * Pair with `createLambdaHandler({ dispatchTo })` so the existing migration
 * Lambda becomes a thin dispatcher that fires this Task only when there is
 * pending work, keeping no-op deploys fast.
 *
 * The Task receives the same `link` surface as the dispatcher Lambda so any
 * migration code can run on either runtime without changes — same DynamoDB
 * tables, secrets, KMS keys, and S3 buckets.
 */
export interface FargateRunnerOptions {
  sst: FargateRunnerSstProvider;
  /**
   * Image to run inside the Task. Either a Docker Hub-style tag or
   * `{ context, dockerfile }` for a locally-built image (the typical shape
   * — SST builds and pushes to ECR on deploy).
   */
  image: sst.aws.TaskArgs['image'];
  /**
   * Resources to link into the Task — DynamoDB tables, secrets, KMS keys,
   * S3 buckets, etc. Mirror this against the dispatcher Lambda's `link`
   * so the same migration code runs identically on either runtime.
   */
  link?: sst.aws.TaskArgs['link'];
  /** Plain env vars (non-Resource). Same shape as `sst.aws.Function.environment`. */
  environment?: sst.aws.TaskArgs['environment'];
  /** Existing VPC to use. If omitted, a fresh `sst.aws.Vpc` is created with NAT disabled. */
  vpc?: sst.aws.Vpc;
  /** Existing cluster to use. If omitted, a fresh `sst.aws.Cluster` is created on the resolved VPC. */
  cluster?: sst.aws.Cluster;
  /** Default `1 vCPU` — override for heavier migrations. */
  cpu?: sst.aws.TaskArgs['cpu'];
  /** Default `2 GB` — override for heavier migrations. */
  memory?: sst.aws.TaskArgs['memory'];
  /** Default `arm64` to match Lambda parity and lower cost. */
  architecture?: sst.aws.TaskArgs['architecture'];
  /** Override the storage size (default 20 GB ephemeral). */
  storage?: sst.aws.TaskArgs['storage'];
  /** Override the resource name prefix. Defaults to `Migration`. */
  namePrefix?: string;
}

export interface FargateRunnerHandles {
  vpc: sst.aws.Vpc;
  cluster: sst.aws.Cluster;
  task: sst.aws.Task;
}

/**
 * Provisions the infra needed to run migrations on AWS Fargate as one-shot
 * Tasks. Returns the `task` so the consumer can `link` it into the dispatcher
 * Lambda (which then calls `task.run(Resource.MigrationTask, …)`).
 *
 * This is the escape hatch from Lambda's 15-minute hard cap. Fargate Tasks
 * have no AWS-imposed timeout — a single migration can run for hours.
 */
export function createFargateRunner(options: FargateRunnerOptions): FargateRunnerHandles {
  const { sst } = options;
  const prefix = options.namePrefix ?? 'Migration';

  // SST `Vpc` defaults to NAT disabled — Tasks land in public subnets with
  // public IPs for ECR / DynamoDB / KMS reach, which is the SST default
  // behaviour for Fargate one-shot Tasks.
  const vpc = options.vpc ?? new sst.aws.Vpc(`${prefix}Vpc`);
  const cluster = options.cluster ?? new sst.aws.Cluster(`${prefix}Cluster`, { vpc });

  const task = new sst.aws.Task(`${prefix}Task`, {
    cluster,
    image: options.image,
    link: options.link,
    environment: options.environment,
    cpu: options.cpu ?? '1 vCPU',
    memory: options.memory ?? '2 GB',
    architecture: options.architecture ?? 'arm64',
    ...(options.storage ? { storage: options.storage } : {}),
  });

  return { vpc, cluster, task };
}

function buildBasicAuthInjection(auth: BasicAuthConfig) {
  const realm = (auth.realm ?? 'Migrations Dashboard').replace(/"/g, '\\"');

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
