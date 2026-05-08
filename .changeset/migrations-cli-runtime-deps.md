---
"@auriclabs/migrations": patch
---

Move CLI runtime deps from `devDependencies` / optional `peerDependencies` to `dependencies` so global installs (`npm i -g @auriclabs/migrations`) and `npx`-from-arbitrary-cwd work.

`auric-migrate-dashboard` (and the other bins) was crashing with `Cannot find package '@aws-sdk/client-dynamodb'` when invoked outside a project that already had the optional peers installed. Affected packages now ship as direct deps:

- `@aws-sdk/client-dynamodb`, `@aws-sdk/client-lambda`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/credential-providers` (used by the dashboard CLI's profile + invoke + storage paths)
- `@inquirer/prompts`, `open` (interactive picker + browser launch)
- `commander`, `electrodb`, `glob`, `uuid` (used by the runtime / CLI / storage code paths)
- `esbuild` (used by `bundleMigrations()`)

`@pulumi/aws` + `@pulumi/pulumi` stay as optional peer deps — they're only needed by `createMigrationBundle` (an SST infra helper), and SST projects already provide them.
