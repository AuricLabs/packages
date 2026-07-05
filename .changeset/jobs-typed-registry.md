---
'@auriclabs/jobs': minor
'@auriclabs/jobs-infra': minor
---

Add typed job registry (defineJobs), in-process registry executor
(createRegistryExecutorHandler), continuation/time-budget helpers
(continueJob, createTimeBudget) with per-attempt continuation state,
and retryJob (which resumes from the last attempt's continuation state).
Fix prepareNextJobAttempt to allow retrying failed jobs and to reject
concurrent attempts on running jobs. jobs-infra: add 'in-process'
executor resource variant that subscribes a consumer-provided handler
with QUEUE_URL_LIST wired, and wire QUEUE_URL_LIST on the lambda
executor so scheduledAt re-enqueue works there too.
