---
"@auriclabs/events": patch
---

Fix DLQ cascading failures: track failed message groups instead of global hasFailed flag so one aggregate's failure no longer sends unrelated aggregates to DLQ
