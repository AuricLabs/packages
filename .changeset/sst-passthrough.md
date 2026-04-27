---
"@auriclabs/migrations": patch
---

Pass `sst` as a parameter to `createTable` and `createDashboard` instead of referencing the global directly, fixing "sst is not defined" errors when the infra entry is imported from published packages.
