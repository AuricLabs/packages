---
"@auriclabs/sst-utils": patch
---

Fix `generateRouterFile` emitting greedy named path params (e.g.
`{path+}`, `{key+}`) into the generated middy router.
`@middy/http-router` only recognizes `{proxy+}` as a wildcard catch-all;
any other named greedy param makes its regex fail to compile, blowing
up the Lambda at cold start.

The generator now rewrites any `{name+}` segment to `{proxy+}` in the
emitted `path` field. API Gateway still receives the original named
param via SST's route configuration — only the router's internal match
table is normalized. Non-greedy named params (`{userId}`) are left
unchanged.
