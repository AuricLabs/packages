---
'@auriclabs/migrations': patch
---

Fix `EACCES: permission denied` when the wrapper tries to write
`/app/migrations-bundle.mjs` at runtime. WORKDIR `/app` is root-owned by
default — the `0.4.x` move of BUNDLE_PATH from `/tmp/` (world-writable)
to `/app/` (root-owned 755) left the `node` user unable to create files
there, so every Fargate task crashed at first download with:

```
[migrations-runner] failed to download bundle:
  EACCES: permission denied, open '/app/migrations-bundle.mjs'
```

Add `RUN chown node:node /app` before `USER node` so the runtime user
can create the bundle file. `/app/node_modules` and `/app/wrapper.mjs`
stay root-owned (readable to `node` via their default 0644 perms).

Maintainer action required after merge: push a `migrations-runner-vX.Y.Z`
tag to republish the Docker image. The npm release alone doesn't move
the image digest consumers pin against.
