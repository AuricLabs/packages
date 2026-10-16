---
'@auriclabs/events': patch
---

Keep event bodies, event-derived identifiers and raw provider errors out of
listener, producer and fan-out logs. Convert event-store provider failures to
fixed operation-only errors before retry logging, while preserving retry
behavior.
