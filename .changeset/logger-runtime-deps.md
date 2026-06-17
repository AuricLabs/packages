---
"@auriclabs/logger": patch
---

Move `@auriclabs/env`, `axios`, and `pino-lambda` from `peerDependencies` to
`dependencies`. The package's entry module (`dist/index.mjs`) imports all three
unconditionally at the top level (env in `logger`/`resolve-log-level`/`create-streams`,
`pino-lambda` in `create-streams`, `axios` in the transports and serializer hooks),
so they are true runtime dependencies, not host-provided peers. As peers they were
not installed for standalone consumers (e.g. `@alfe.ai/openclaw` installed into a
fresh `node_modules`), causing `Cannot find package '@auriclabs/env'` at plugin load.

`sst` remains a `peerDependency` (it is not imported at runtime). `zod` is **not**
affected here — it is a peer of `@auriclabs/env` by design (env accepts
consumer-supplied zod schemas and relies on a single shared zod instance), so it
must be satisfied by the composition root, not bundled.
