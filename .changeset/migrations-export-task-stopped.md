---
'@auriclabs/migrations': patch
---

Fix missing `attachTaskStoppedRule` export from the `0.4.0` release. The
function was added to `src/infra/index.ts` but never plumbed through
`src/infra.entry.ts` (the tsdown bundle entry), so consumers importing
from `@auriclabs/migrations/infra` saw `TS2305: Module ... has no
exported member 'attachTaskStoppedRule'`. Same for the
`TaskStoppedResult` type missing from the package root barrel.

No code changes — only the published surface. Consumers on `0.4.0` should
bump to `0.4.1` to access the new helper.
