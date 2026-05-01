---
"@auriclabs/migrations": minor
---

Add HTTP basic auth on the dashboard and CLI commands for browsing run history.

- **`createDashboard` accepts `auth?: BasicAuthConfig`** — when set, attaches a CloudFront viewer-request function to the static site that rejects requests without a matching `Authorization: Basic <base64>` header. Credentials are inlined into the function source at deploy time via Pulumi apply (so they live in CloudFront config, the same trust boundary as SST secret state). Note: this only gates the static UI — the API gateway URL stays directly callable, since browsers don't auto-send basic auth credentials cross-origin. Use it as discovery-prevention for the dashboard, not API protection.

- **CLI: `auric-migrate executions [id]`** — lists recent execution batches with status, direction, migration count, started-time, and total duration. Pass an execution id to drill in (with `--detail` to expand each migration's description, result, output, and error). Useful in prod where the dashboard isn't deployed.

- **CLI: `auric-migrate migration <id>`** — shows a migration's run history, with the latest run expanded by default (description, error, result, captured output). `--all` expands every run. Reuses the same record data the dashboard already displays.

Both CLI commands take `-c, --config <path>` like the existing `up` / `down` / `status` commands and use the configured `MigrationStorage` directly — no extra infra needed.
