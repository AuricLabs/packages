---
"@auriclabs/sst-utils": patch
---

`registerApiRoutes` (consolidated mode): allow `onConsolidatedFunction` to return `{ qualifierName }`. When provided, the API Gateway integration's `integrationUri` and the `lambda:InvokeFunction` permission both target the qualified ARN (`<fn.arn>:<qualifierName>`) instead of the unqualified `$LATEST`. This is what makes provisioned concurrency on a Lambda alias actually receive traffic — without it the integration calls `$LATEST` and any PC pinned on the alias sits idle.
