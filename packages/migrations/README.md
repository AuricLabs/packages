# @auriclabs/migrations

A database migration framework with DynamoDB storage, AWS Lambda support, a CLI, and an optional web dashboard.

## Features

- TypeScript-first migration authoring with `up` / `down` functions
- DynamoDB-backed storage with ElectroDB
- AWS Lambda handler with automatic timeout detection and self-continuation
- ECS Fargate runner for migrations exceeding Lambda's 15-minute cap
- CLI for creating, running, and inspecting migrations
- Optional React dashboard for visualising status and triggering rollbacks
- **`auric-migrate-dashboard`** — run the dashboard locally in your browser against any AWS account, gated by your AWS SSO profile and IAM identity (no public surface required)
- SST infrastructure definitions for one-line provisioning

## Local dashboard against any account

Production deploys typically don't expose the dashboard (the deployed dashboard would require a public API gateway, which is the wrong trust boundary for an admin tool). Use the local dashboard CLI to view migration state — including in production — entirely through your AWS SSO credentials:

```bash
# pick a profile interactively, autodiscover the deployed Lambda + table
npx -y @auriclabs/migrations auric-migrate-dashboard

# or skip the picker
npx -y @auriclabs/migrations auric-migrate-dashboard --profile alfe-prod
```

The CLI:

1. Lists profiles from `~/.aws/config` and `~/.aws/credentials`; honours `--profile <name>` and `AWS_PROFILE`.
2. Resolves credentials via `fromIni` (transparently follows SSO sessions and `role_arn` assumed roles). On expired SSO it prompts to confirm and runs `aws sso login --profile <name>` for you.
3. Discovers the deployed `MigrationFn` Lambda and `MigrationsTable` DynamoDB table; prompts you to choose if multiple match. Override with `--function-name <name>` / `--table-name <name>`.
4. Spins up an HTTP server on `127.0.0.1:3100` (configurable via `--port`), serves the same dashboard UI the deployed version uses, and opens your browser.
5. All `/api/*` calls flow through your AWS SDK identity — `Lambda Invoke` for migrate/rollback/status, `DynamoDB` for read queries.

The CLI requires the AWS CLI on your `$PATH` for the SSO auto-login flow. The local server only listens on `127.0.0.1` — nothing is exposed to the network.

## Installation

```bash
pnpm add @auriclabs/migrations
```

Peer dependencies (install as needed):

```bash
pnpm add sst                        # required for infra definitions
pnpm add @aws-sdk/client-lambda     # required for Lambda continuation & dashboard rollback
```

## Writing Migrations

Generate a timestamped migration file:

```bash
npx auric-migrate create add-user-roles
```

This creates `migrations/20250601120000_add-user-roles.ts` with a scaffold. Here's what a real migration looks like:

```typescript
// migrations/20250601120000_add-user-roles.ts
import type { Migration } from '@auriclabs/migrations';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient());

export default {
  name: 'add-user-roles',
  async up() {
    await client.send(new PutCommand({
      TableName: 'Roles',
      Item: { pk: 'role#admin', name: 'Admin', permissions: ['read', 'write', 'delete'] },
    }));
    await client.send(new PutCommand({
      TableName: 'Roles',
      Item: { pk: 'role#viewer', name: 'Viewer', permissions: ['read'] },
    }));
  },
  async down() {
    const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
    await client.send(new DeleteCommand({ TableName: 'Roles', Key: { pk: 'role#admin' } }));
    await client.send(new DeleteCommand({ TableName: 'Roles', Key: { pk: 'role#viewer' } }));
  },
} satisfies Migration;
```

Each migration must implement both `up` (apply) and `down` (rollback). The `down` function is what gets called when you trigger a rollback from the CLI, Lambda, or dashboard.

### Documenting and Diagnosing Migrations

Each migration can carry a markdown `description` and emit log output during a run. Both surface on the dashboard's migration detail page so you can see *what* a migration was supposed to do and *what actually happened* without leaving the UI.

```typescript
export default {
  name: 'add-user-roles',
  description: `## Adds default roles

Seeds \`role#admin\` and \`role#viewer\` rows into the \`Roles\` table.

- Idempotent: re-running has no additional effect.
- Required before the dashboard auth refactor.`,
  async up(ctx) {
    await client.send(/* ... */);
    ctx.log?.('seeded admin role');
    ctx.log?.('seeded viewer role');
  },
  async down(ctx) {
    /* ... */
    ctx.logger?.warn('roles table now empty');
  },
} satisfies Migration;
```

Notes:

- `description` is snapshotted onto every migration record when the migration runs, so historical records always show the description that was true at the time. Editing the source later does not rewrite history.
- `ctx.log(message, ...rest)` and `ctx.logger.{info,warn,error,debug}` write into a captured output buffer that is persisted on the record. Direct `console.log/warn/error` calls during the migration are also captured.
- Output is capped at 200 KB per run via a ring buffer (oldest lines drop first; the most recent output is always preserved). When this happens the record's `outputTruncated` flag is set and a banner is shown in the dashboard.

## CLI

```bash
npx auric-migrate <command>
```

| Command | Description |
|---------|-------------|
| `create <name>` | Create a new migration file |
| `up` | Run pending migrations |
| `down` | Roll back completed migrations |
| `status` | Show pending, completed, and failed migrations |
| `list` | List migration files on disk |

Options common to `up`, `down`, and `status`:

- `--to <name>` — stop after a specific migration
- `-c, --config <path>` — path to config file (default: `./migrate.config.ts`)

## Programmatic Usage

There are three ways to run migrations:

| Method | How it works |
|--------|-------------|
| **CLI** (`auric-migrate up/down`) | Runs `MigrationRunner` directly in the local Node process |
| **Lambda** (`createLambdaHandler`) | Runs `MigrationRunner` inside a Lambda with timeout detection and self-continuation |
| **Dashboard rollback** | Async-invokes the migration Lambda with `direction: 'down'` — does not run migrations itself |

All three use `MigrationRunner` as the core engine. The dashboard delegates to the migration Lambda rather than running migrations in-process, so timeout handling and continuation work correctly.

### Running Migrations

```typescript
import { MigrationRunner } from '@auriclabs/migrations';
import { DynamoDBMigrationStorage } from '@auriclabs/migrations/dynamodb';

const runner = new MigrationRunner({
  migrationsDir: './migrations',
  storage: new DynamoDBMigrationStorage(),
  context: { /* passed to each migration's up/down */ },
});

const result = await runner.up();        // run all pending
const result = await runner.down();      // roll back all completed
const status = await runner.status();    // { pending, completed, failed }
```

### AWS Lambda Handler

`createLambdaHandler` wraps the runner with timeout detection. When Lambda is about to time out it persists progress and re-invokes itself asynchronously to continue where it left off.

**Important:** Lambda functions are bundled by esbuild, which cannot follow dynamic `import()` calls with variable paths. This means `migrationsDir` (which uses glob + dynamic import) won't work in Lambda — the migration files won't be included in the bundle. Use `defineMigrations` with static imports instead:

```typescript
// backend/migrations/handler.ts
import { createLambdaHandler, defineMigrations } from '@auriclabs/migrations';
import { DynamoDBMigrationStorage } from '@auriclabs/migrations/dynamodb';

import addUserRoles from './migrations/20250601120000_add-user-roles';
import addPermissions from './migrations/20250602120000_add-permissions';

const migrations = defineMigrations({
  '20250601120000_add-user-roles': addUserRoles,
  '20250602120000_add-permissions': addPermissions,
});

export const handler = createLambdaHandler({
  createConfig: () => ({
    migrations,
    storage: new DynamoDBMigrationStorage(),
    context: {},
  }),
});
```

`defineMigrations` takes a record keyed by migration filename stem (must match the `{timestamp}_{name}` format used by the CLI). Entries are sorted by key to ensure correct execution order. The IDs are compatible with `migrationsDir`, so you can use the CLI locally and Lambda in production against the same DynamoDB table.

The handler accepts an event with optional `direction` (`'up'` | `'down'`) and `target` fields. This is the same Lambda the [dashboard](#dashboard-opt-in) invokes for rollback.

> **CLI vs Lambda:** Use `migrationsDir` for the CLI and local Node processes (glob + dynamic import works fine). Use `migrations` with `defineMigrations` for Lambda deployments (static imports are bundled by esbuild).

## Infrastructure (SST)

The package ships SST resource definitions. Import from the `/infra` subpath:

```typescript
// sst.config.ts
import { table } from '@auriclabs/migrations/infra';

// DynamoDB table with the required primary key and GSIs pre-configured
const migrationsTable = table;

// Lambda that runs your migrations (uses the handler from the previous section)
const migrationFn = new sst.aws.Function('MigrationFn', {
  handler: 'backend/migrations/handler.handler',
  link: [migrationsTable],
});
```

`migrationFn` is your migration runner Lambda — it's what executes `up`/`down` migration code. The dashboard (below) can reference it to enable rollback from the UI.

## Dashboard (Opt-in)

The dashboard adds a React web UI for visualising migration status and triggering rollbacks. It is entirely opt-in — nothing is deployed unless you call `createDashboard()`.

### Architecture

The dashboard uses two Lambdas, each with a single responsibility:

```
┌─────────────────────┐         ┌──────────────────────┐
│  Dashboard Lambda   │         │  Migration Lambda     │
│  (API Gateway)      │         │  (createLambdaHandler)│
│                     │         │                       │
│  - GET  /api/*      │  async  │  - Runs up/down       │
│  - POST /api/       │──invoke─│  - Timeout detection  │
│    rollback         │         │  - Self-continuation   │
│                     │         │                       │
│  Read-only queries  │         │  Executes migrations  │
│  + rollback trigger │         │  against your DB      │
└─────────────────────┘         └──────────────────────┘
```

- **Dashboard Lambda** — serves the API (migration status, execution history) and triggers rollbacks. It only reads from DynamoDB and does not execute migration code.
- **Migration Lambda** — the same Lambda you already deploy for running migrations via `createLambdaHandler`. It handles `up`/`down` execution, timeout detection, and self-continuation.

When a rollback is triggered from the dashboard, the dashboard Lambda async-invokes the migration Lambda with `{ direction: 'down' }`. This keeps the migration runner's timeout and continuation logic in one place, and means the dashboard Lambda doesn't need access to your migration files or application context.

### Setup

#### 1. Migration Lambda (you likely already have this)

```typescript
// backend/migrations/handler.ts
import { createLambdaHandler, defineMigrations } from '@auriclabs/migrations';
import { DynamoDBMigrationStorage } from '@auriclabs/migrations/dynamodb';

import addUserRoles from './migrations/20250601120000_add-user-roles';
import addPermissions from './migrations/20250602120000_add-permissions';

const migrations = defineMigrations({
  '20250601120000_add-user-roles': addUserRoles,
  '20250602120000_add-permissions': addPermissions,
});

export const handler = createLambdaHandler({
  createConfig: () => ({
    migrations,
    storage: new DynamoDBMigrationStorage(),
    context: {},
  }),
});
```

#### 2. Dashboard API handler

```typescript
// backend/migrations/dashboard.ts
import { createDashboardApiHandler } from '@auriclabs/migrations/api';
import { DynamoDBMigrationStorage } from '@auriclabs/migrations/dynamodb';

export const handler = createDashboardApiHandler({
  storage: new DynamoDBMigrationStorage(),
});
```

No manual wiring needed — `createDashboard()` automatically sets the `MIGRATION_FUNCTION_NAME` environment variable on the dashboard Lambda when `migrationFn` is provided.

#### 3. SST config

Add `createDashboard()` alongside the table and migration Lambda defined in the [Infrastructure](#infrastructure-sst) section:

```typescript
// sst.config.ts
import { table, createDashboard } from '@auriclabs/migrations/infra';

const migrationsTable = table;

const migrationFn = new sst.aws.Function('MigrationFn', {
  handler: 'backend/migrations/handler.handler',
  link: [migrationsTable],
});

// Dashboard — opt-in
const dashboard = createDashboard({
  table: migrationsTable,
  handler: 'backend/migrations/dashboard.handler',
  migrationFn,                               // optional — enables rollback from the UI
  domain: 'migrations.example.com',          // optional
});
```

This provisions:

- **API Gateway** — single Lambda handling all `/api/*` routes
- **StaticSite** — pre-built React SPA served via CloudFront

`migrationFn` is the same Lambda defined in the infra section — the one that runs your migration code. Passing it here does two things: grants the dashboard Lambda permission to invoke it, and sets the `MIGRATION_FUNCTION_NAME` environment variable automatically.

Without `migrationFn`, the dashboard is read-only and the rollback endpoint returns an error.

### Production Safety

The dashboard has no built-in authentication — it is designed to be **excluded from production deployments** at the infrastructure level. Gate deployment using your environment config:

```typescript
// infra/migrations.ts
import { table, createDashboard } from '@auriclabs/migrations/infra';

const migrationsTable = table;

const migrationFn = new sst.aws.Function('MigrationFn', {
  handler: 'backend/migrations/handler.handler',
  link: [migrationsTable],
});

// Dashboard — non-production only
let dashboard: ReturnType<typeof createDashboard> | undefined;

if (config.environment !== 'production') {
  dashboard = createDashboard({
    table: migrationsTable,
    handler: 'backend/migrations/dashboard.handler',
    migrationFn,
    domain: `migrations.${config.appDomain}`,
  });
}
```

In production, only the `MigrationsTable` and `MigrationFn` Lambda are deployed. No API Gateway, no StaticSite, no HTTP endpoints — there is nothing to attack.

For non-production stages that need protection, add CloudFront basic auth or restrict access via WAF/security groups at the infra layer.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/migrations` | Latest state per migration (deduplicated) |
| GET | `/api/migrations/summary` | Counts: `{ pending, completed, failed, total }` |
| GET | `/api/migrations/{id}` | Full history for one migration |
| GET | `/api/executions` | Execution batches with metadata |
| GET | `/api/executions/{id}` | All migrations in one execution |
| POST | `/api/rollback` | Body: `{ target?: string }` — async-invokes migration Lambda with `direction: 'down'` |

### Dashboard Pages

- **Dashboard** — summary cards (completed / pending / failed / total) and recent executions
- **Migrations** — filterable table of all migrations with status, rollback button
- **Migration Detail** — execution history for a single migration
- **Executions** — list of execution batches, expandable to individual migrations

## Package Exports

| Import path | Contents |
|-------------|----------|
| `@auriclabs/migrations` | Core types, `MigrationRunner`, `createLambdaHandler`, `createDashboardApiHandler` |
| `@auriclabs/migrations/dynamodb` | `DynamoDBMigrationStorage`, ElectroDB entity |
| `@auriclabs/migrations/infra` | SST `table`, `createDashboard()` |
| `@auriclabs/migrations/api` | `createDashboardApiHandler` |

## Development

```bash
pnpm build          # build library (CJS + ESM + DTS)
pnpm build:ui       # build React dashboard (Vite → ui/dist/)
pnpm dev            # watch mode
pnpm lint           # ESLint
pnpm typecheck      # TypeScript
pnpm test           # Vitest
```

## License

ISC
