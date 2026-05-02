---
"@auriclabs/migrations": patch
---

Fix `createDashboard({ auth })` throwing `ReferenceError: aws is not
defined` at deploy time.

The 0.1.x dashboard auth path called `new aws.cloudfront.Function(...)`
relying on `aws` being a runtime global. SST only injects `aws` as a
global into the user's compiled `sst.config.ts` — when this package's
ESM bundle runs from `node_modules`, `aws` is `undefined`, so the very
first deploy that set `auth` failed.

Refactored the auth implementation to use SST's first-party
`StaticSite.edge.viewerRequest.injection` escape hatch instead of
attaching a separate `aws.cloudfront.Function` via `transform.cdn`.
The basic-auth check is now spliced into the start of the StaticSite's
existing CloudFront viewer-request function and returns a 401 before
any routing logic runs. No new caller arguments — the `auth` option
behaves the same way it was always documented to.
