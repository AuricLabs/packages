---
"@auriclabs/sst-utils": minor
---

Add `onConsolidatedFunction` callback to `registerApiRoutes`. Fires once per consolidated Lambda group (in `consolidate: true` mode), receiving the resource name and the `sst.aws.Function` reference. Lets callers attach provisioned concurrency, alarms, or aliases to the consolidated Lambda without forking the module.
