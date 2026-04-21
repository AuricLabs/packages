---
"@auriclabs/sst-utils": patch
---

Sort consolidated router routes by specificity so static path segments match before parameterized ones. Fixes @middy/http-router matching `/subscriptions/{referenceId}` before `/subscriptions/platform/{tenantId}`.
