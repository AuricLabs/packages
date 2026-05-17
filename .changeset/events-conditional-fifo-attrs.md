---
"@auriclabs/events": minor
---

stream-handler: detect FIFO queues by `.fifo` URL suffix and only include
`MessageGroupId` / `MessageDeduplicationId` on entries when the target is FIFO.
Standard SQS queues reject those attributes per-entry in `Failed[]`, so sending
them on every batch caused silent message loss on any standard listener queue
in a fan-out.

Also: any non-empty `Failed[]` on `SendMessageBatch`, or `FailedEntryCount > 0`
on EventBridge `PutEvents`, now throws — partial failures previously went
unobserved. The existing error logs no longer include full event payloads
(eventId / aggregateId / aggregateType / eventType only) to reduce PII leakage
into CloudWatch.
