---
"@auriclabs/migrations": minor
---

Generic published `migrations-runner` image + S3-bundled migrations pattern.

Consumers no longer write a per-repo Dockerfile to escape Lambda's 15-minute cap. Instead:

1. **Published image** — `docker.io/auriclabs/migrations-runner:1` ships a node:22-slim + AWS SDK + a fetch+verify+exec wrapper. Built and pushed by the new `.github/workflows/publish-image.yml` workflow on `migrations-runner-v*` tags.
2. **`bundleMigrations({ entryPoint, outFile })`** — programmatic API exported from the package. Bundles your migrations directory + workspace cross-imports into a single ESM file via esbuild, externalising `@aws-sdk/*`, `@smithy/*`, `@aws-crypto/*` (the runner image's pre-installed packages). Returns the file path, size, and SHA256.
3. **`auric-migrate-bundle`** — new CLI bin for ad-hoc local bundling.
4. **`createMigrationBundle({ sst, entryPoint })`** — new SST infra helper. Bundles at deploy time, creates a private+versioned+SSE bucket, uploads as `bundles/bundle-<sha256>.mjs` (content-addressed for atomic deploys + trivial rollback), returns a `Linkable` handle that grants `s3:GetObject` on exactly the bundle key.
5. **`createFargateRunner({ bundle })`** — accepts a bundle handle. Auto-wires `link` (Task role gets `s3:GetObject`) + `MIGRATION_BUNDLE_URL` / `MIGRATION_BUNDLE_SHA256` env vars. Image now defaults to `docker.io/auriclabs/migrations-runner:1`.

Trust: bundle is privileged code (runs in the consumer's account). Pin the image by digest in production so a Docker Hub compromise can't silently swap a tag.

New deps: `esbuild` (direct), `@pulumi/aws` (peer, optional), `@pulumi/pulumi` (peer, optional). `@aws-sdk/lib-dynamodb` joins the existing optional peer-dep list.
