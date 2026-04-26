---
"@auriclabs/migrations": patch
---

Pass timeoutManager through migration context so long-running migrations can call `context.timeoutManager?.shouldStop()` to check if the Lambda is approaching its timeout.
