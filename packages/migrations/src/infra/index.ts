import { createRequire } from 'node:module';
import path from 'node:path';

import { bundleMigrations } from '../bundling';

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

export interface MigrationBundleSstProvider {
  aws: {
    Bucket: typeof sst.aws.Bucket;
    permission: typeof sst.aws.permission;
  };
  Linkable: typeof sst.Linkable;
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
 * Default published image for the Fargate runner. Mutable major-version tag
 * (`:1`) so consumers track patch releases. Pin by digest in production
 * (`docker.io/auriclabs/migrations-runner@sha256:...`) for byte-exact
 * reproducibility — `createFargateRunner` accepts an `image` override that
 * takes precedence over this default.
 */
export const DEFAULT_RUNNER_IMAGE = 'docker.io/auriclabs/migrations-runner:1';

/** Options for `createMigrationBundle` — bundles migrations + uploads to S3. */
export interface CreateMigrationBundleOptions {
  sst: MigrationBundleSstProvider;
  /**
   * Entry file for the bundle, relative to `cwd` or absolute. Typically
   * `migrations/fargate-entry.ts` — a thin file that imports
   * `runMigrationsInFargateAsCli` and the consumer's static migrations
   * registry.
   */
  entryPoint: string;
  /**
   * Existing bucket to upload to. If omitted, a fresh `sst.aws.Bucket` is
   * created (private, SSE-S3 encrypted, versioned).
   */
  bucket?: sst.aws.Bucket;
  /**
   * Workspace root for `bundleMigrations`'s esbuild resolver. Defaults to
   * `process.cwd()` (the directory `sst deploy` was run from).
   */
  cwd?: string;
  /**
   * Override the resource name prefix. Defaults to `MigrationBundle`.
   */
  namePrefix?: string;
  /**
   * Local directory to write the bundle to before upload. Defaults to
   * `<cwd>/.sst/migrations-bundle`.
   */
  localOutDir?: string;
  /**
   * Object key prefix in the bucket. Defaults to `bundles/`. The full key
   * becomes `<prefix>bundle-<sha256>.mjs` (content-addressed).
   */
  keyPrefix?: string;
}

/**
 * Handle returned by `createMigrationBundle`. The `linkable` field is what
 * consumers `link: [bundle.linkable]` into the dispatcher Lambda + Task —
 * it grants `s3:GetObject` on the bundle key and exposes
 * `Resource.MigrationBundle.url` / `.sha256` at runtime.
 */
export interface MigrationBundleHandle {
  /** S3 bucket holding the bundle (auto-created or passed in). */
  bucket: sst.aws.Bucket;
  /** Key under the bucket: `<keyPrefix>bundle-<sha256>.mjs`. */
  key: string;
  /** Full `s3://bucket/key` URL — set as `MIGRATION_BUNDLE_URL` on the Task. */
  url: $util.Output<string>;
  /** Hex SHA256 — set as `MIGRATION_BUNDLE_SHA256` on the Task for verification. */
  sha256: string;
  /** Linkable handle — pass to `link:` on the Task / dispatcher Lambda. */
  linkable: sst.Linkable<{
    url: $util.Output<string>;
    sha256: string;
    bucket: $util.Output<string>;
    key: string;
  }>;
}

/**
 * Bundle a migrations entry into a single ESM file and upload it to S3,
 * returning a `Linkable` handle the consumer wires into the Fargate Task.
 *
 * The bucket is private + versioned + encrypted by default. The object is
 * content-addressed (`bundle-<sha256>.mjs`), so re-deploying with identical
 * code is a no-op for Pulumi, and rolling back to a previous bundle is just
 * a matter of pointing `MIGRATION_BUNDLE_URL` at an older key.
 *
 * Pair with `createFargateRunner({ bundle })` to wire everything together
 * automatically — Task gets `s3:GetObject` perms via `link`, and the env
 * vars `MIGRATION_BUNDLE_URL` + `MIGRATION_BUNDLE_SHA256` get set for the
 * runner image's wrapper to consume.
 */
export async function createMigrationBundle(
  options: CreateMigrationBundleOptions,
): Promise<MigrationBundleHandle> {
  const { sst } = options;
  const prefix = options.namePrefix ?? 'MigrationBundle';
  const keyPrefix = options.keyPrefix ?? 'bundles/';

  const cwd = options.cwd ?? process.cwd();
  const localOutDir = options.localOutDir ?? path.join(cwd, '.sst', 'migrations-bundle');
  const localOutFile = path.join(localOutDir, 'bundle.mjs');

  // Bundle synchronously at deploy-program-eval time. This runs before any
  // Pulumi resource creation, so the bundle file is on disk by the time we
  // construct the BucketObject below.
  const result = await bundleMigrations({
    entryPoint: options.entryPoint,
    outFile: localOutFile,
    cwd,
  });

  const bucket =
    options.bucket ??
    new sst.aws.Bucket(`${prefix}Bucket`, {
      // SST `Bucket` defaults to private + SSE-S3 + enforce-https.
      // Add versioning so rolled-back bundles persist for forensics.
      versioning: true,
    });

  const key = `${keyPrefix}bundle-${result.sha256}.mjs`;

  // Pulumi-native upload via `aws.s3.BucketObject`. The resource is named
  // by a short SHA prefix so duplicate-content deploys are no-ops, and
  // distinct content always lands as a new object (the older one stays in
  // the versioned bucket for rollback).
  //
  // Loaded via dynamic `import()` rather than top-level so consumers who
  // don't use this helper aren't forced to install `@pulumi/aws` /
  // `@pulumi/pulumi` (they're declared as optional peer deps). This file
  // is bundled in both CJS and ESM modes, so we use ESM dynamic import
  // — `require` is not defined globally in the ESM build.
  const [{ s3 }, pulumi] = await Promise.all([import('@pulumi/aws'), import('@pulumi/pulumi')]);

  new s3.BucketObject(`${prefix}Object-${result.sha256.slice(0, 8)}`, {
    bucket: bucket.name,
    key,
    source: new pulumi.asset.FileAsset(result.outFile),
    contentType: 'application/javascript',
    serverSideEncryption: 'AES256',
  });

  const url = bucket.name.apply((name) => `s3://${name}/${key}`);

  const linkable = new sst.Linkable(prefix, {
    properties: {
      url,
      sha256: result.sha256,
      bucket: bucket.name,
      key,
    },
    include: [
      sst.aws.permission({
        actions: ['s3:GetObject'],
        resources: [bucket.arn.apply((arn) => `${arn}/${key}`)],
      }),
    ],
  });

  return { bucket, key, url, sha256: result.sha256, linkable };
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
   * Image to run inside the Task. Defaults to the published
   * `auriclabs/migrations-runner:1` on Docker Hub when omitted, which knows
   * how to fetch a bundle from S3 (set via `MIGRATION_BUNDLE_URL` env or
   * the `bundle` option below). Pin to a digest in production:
   * `docker.io/auriclabs/migrations-runner@sha256:...`.
   */
  image?: sst.aws.TaskArgs['image'];
  /**
   * Bundle handle from `createMigrationBundle`. When set, the runner is
   * pre-wired: the bucket is added to `link`, and `MIGRATION_BUNDLE_URL` +
   * `MIGRATION_BUNDLE_SHA256` are set on the Task's env so the runner image's
   * wrapper fetches and verifies the bundle on start.
   */
  bundle?: MigrationBundleHandle;
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

  // Start from the consumer's args, then layer the bundle wiring on top.
  // Splitting the merge this way avoids spreading a value typed as a Pulumi
  // Input (which TS can't statically guarantee is a plain object).
  const taskArgs: sst.aws.TaskArgs = {
    cluster,
    image: options.image ?? DEFAULT_RUNNER_IMAGE,
    cpu: options.cpu ?? '1 vCPU',
    memory: options.memory ?? '2 GB',
    architecture: options.architecture ?? 'arm64',
    ...(options.storage ? { storage: options.storage } : {}),
    ...(options.link ? { link: options.link } : {}),
    ...(options.environment ? { environment: options.environment } : {}),
  };

  if (options.bundle) {
    // Prepend the bundle's linkable so its `s3:GetObject` permission lands
    // on the Task role; preserve any consumer-supplied links after it.
    const existingLink = (taskArgs.link as unknown[] | undefined) ?? [];
    taskArgs.link = [options.bundle.linkable, ...existingLink] as sst.aws.TaskArgs['link'];

    // Layer bundle env vars on top so they take precedence over any
    // consumer values for the same keys (the runner image needs them).
    const existingEnv =
      (taskArgs.environment as Record<string, $util.Input<string>> | undefined) ?? {};
    taskArgs.environment = {
      ...existingEnv,
      MIGRATION_BUNDLE_URL: options.bundle.url,
      MIGRATION_BUNDLE_SHA256: options.bundle.sha256,
    };
  }

  const task = new sst.aws.Task(`${prefix}Task`, taskArgs);

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
