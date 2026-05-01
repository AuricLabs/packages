---
"@auriclabs/migrations": patch
---

Fix `DynamoDBMigrationStorage` silently dropping `description`, `output`, and `outputTruncated`.

The 0.1.0 release added these fields to the storage type, the runner, the
ElectroDB schema, and the dashboard UI — but the marshaling layer in
`DynamoDBMigrationStorage` (which translates between the typed
`MigrationRecord` and the ElectroDB entity) was never updated to pass them
through. The result: the runner captured descriptions and per-run output,
the schema accepted them, but they never landed in DynamoDB, so the
dashboard's expansion panels stayed empty even after a clean redeploy.

`createRecord` now passes `description`, `output`, and `outputTruncated`
to `entity.put()`; `updateRecord` includes the same three in its
conditional `set()` body; `toMigrationRecord` returns them from the DDB
row. Backfilled with regression tests so a future field addition doesn't
hit the same gap.
