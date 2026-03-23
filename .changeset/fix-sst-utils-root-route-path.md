---
"@auriclabs/sst-utils": patch
---

Fix route path extraction for root-level handler files (e.g. `get.ts`, `post.ts` at the top of the routesDir). The regex now makes the leading `/` optional so root-level method files resolve to the prefix path correctly instead of producing routes like `GET /agents/get`.
