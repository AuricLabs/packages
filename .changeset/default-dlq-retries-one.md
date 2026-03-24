---
"@auriclabs/events-infra": patch
---

Change default dlqRetries from 3 to 1 in createEventQueue to reduce FIFO message group blocking time on failures.
