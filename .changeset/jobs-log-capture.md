---
'@auriclabs/jobs': minor
---

Migration-dashboard parity for job logs and re-runs. Job handlers get
`context.log` / `context.logger` that capture output onto the attempt
row (byte-capped OutputBuffer, `output` + `outputTruncated` attributes,
persisted on completion, failure, and continuation slices — per-attempt
and concurrency-safe). The dashboard's attempt detail renders the
captured output with copy + truncation notice, and the retry action is
labeled Re-run for completed jobs vs Retry for failed ones (same
endpoint underneath).
