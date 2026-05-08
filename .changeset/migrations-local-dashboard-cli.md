---
"@auriclabs/migrations": minor
---

Add `auric-migrate-dashboard` — a public CLI that runs the existing dashboard UI **locally** in the user's browser, gated by AWS SSO. Picks an AWS profile (interactive or via `--profile`), resolves credentials via `fromIni` (auto-runs `aws sso login` on expired SSO sessions), discovers the deployed `MigrationFn` Lambda + `MigrationsTable` (interactive picker if multiple match), spins up a Node HTTP server on `127.0.0.1:3100`, and opens the browser.

Useful for inspecting / rolling back migrations against accounts where the deployed dashboard is intentionally disabled (e.g. production). All API calls flow through the user's IAM identity; no public network surface is created.

New exports from the runtime barrel: `runDashboardCli`, `pickProfile`, `loadCredentials`, `ensureCredentialsValid`, `findFunction`, `findTable`, `startDashboardServer`, `type AwsProfile`, `type DashboardServer`.

Requires the AWS CLI on `$PATH` for the SSO auto-login flow. New peer dep `@aws-sdk/lib-dynamodb` (optional) for the dashboard's DynamoDB access path.
