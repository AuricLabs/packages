---
"@auriclabs/sst-utils": minor
---

Use Pulumi primitives for consolidated routes to fix AWS Lambda 20KB resource policy limit. Consolidated mode now creates a single `aws.lambda.Permission` per Lambda group instead of one per route, avoiding `PolicyLengthExceededException` on services with many routes (e.g. org with 61 routes). Requires passing the `aws` provider instance via the new `aws` option when `consolidate` is true.
