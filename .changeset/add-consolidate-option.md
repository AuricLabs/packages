---
"@auriclabs/sst-utils": minor
---

Add `consolidate` option to `registerApiRoutes` that groups routes by function config into shared Lambdas via `@middy/http-router`, reducing cold starts and API Gateway integration count.
