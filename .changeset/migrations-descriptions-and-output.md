---
"@auriclabs/migrations": minor
---

Add migration descriptions and per-run output capture.

- **Descriptions** — Migrations can now declare an optional `description` (markdown). The runner snapshots it onto every migration record at run time, and the dashboard renders it as a card on the migration detail page.
- **Output capture** — The runner injects `ctx.log(message, ...rest)` and a structured `ctx.logger` into the migration context, and tees `console.log/warn/error` for the duration of each run. Captured output is persisted on the record (200 KB cap with a tail-preserving ring buffer; `outputTruncated` set when older lines drop). Expandable rows on the dashboard now show the captured output, the structured `metadata` returned from `up`/`down` (with JSON syntax highlighting), and any error.

Both additions are backwards compatible — old migrations without `description` and old records without `output` render as before. Migration list endpoints strip `output` to keep payloads small; the detail endpoint returns the full record.
