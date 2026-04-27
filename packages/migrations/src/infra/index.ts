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

export interface DashboardOptions {
  sst: SstProvider;
  table: sst.aws.Dynamo;
  handler: string;
  migrationFn?: sst.aws.Function;
  domain?: sst.aws.StaticSiteArgs['domain'];
  nodejs?: sst.aws.FunctionArgs['nodejs'];
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
  const uiAbsPath = path.join(pkgRoot, 'ui');
  const uiPath = path.relative(process.cwd(), uiAbsPath);

  const site = new sst.aws.StaticSite('Migrations', {
    path: uiPath,
    build: {
      command: 'npx vite build',
      output: 'dist',
    },
    dev: {
      command: 'npx vite dev',
      url: 'http://localhost:3100',
    },
    environment: {
      VITE_API_URL: api.url,
    },
    domain: options.domain,
  });

  return { api, site };
}
