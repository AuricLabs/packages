---
"@auriclabs/sst-utils": patch
---

Fix ReferenceError when `aws` global is accessed from node_modules. The `aws` identifier is only available at the type level via SST's `export import` declaration and is not set on `globalThis` at runtime. Removed hardcoded `aws` from constructProperties calls — consumers should pass it through the `variables` option instead.
