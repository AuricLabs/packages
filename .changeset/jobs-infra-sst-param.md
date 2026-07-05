---
"@auriclabs/jobs-infra": minor
---

Take the `sst` components namespace as an explicit parameter in `createJobTable` and `createJobsDashboard` instead of referencing the injected `sst` global.

`@auriclabs/jobs-infra` ships as ESM (`dist/index.mjs`). SST's config evaluator injects the `sst` global into config source through an esbuild `onLoad` plugin whose filter is `\.(js|ts|jsx|tsx)$`, which deliberately skips `.mjs`/`.cjs`. (`$app` / `$jsonStringify` / `$output` arrive via esbuild `Define`/`Inject`, which are extension-agnostic and keep working — only the `sst` namespace and `@pulumi/*` provider aliases come from the skipped `onLoad` channel.) A bare `sst.aws.Dynamo` reference in the `.mjs` build therefore threw `ReferenceError: sst is not defined` at deploy time. Passing `sst` in as a parameter — as `@auriclabs/migrations`' `createTable(sst)` already does — sidesteps the injection entirely.

Breaking:
- `createJobTable(name)` → `createJobTable(sst, name)`
- `createJobsDashboard(options)` now requires `options.sst`

`registerJobResources` is unchanged: it only uses `$jsonStringify` (an `Inject` global that works in `.mjs`) plus caller-supplied resources.
