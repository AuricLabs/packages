---
"@auriclabs/migrations": patch
---

Bundle all runtime deps (electrodb, sst, commander, glob, uuid) into dist output and move to devDependencies. Replace MUI with Tailwind CSS + TanStack Table + Radix Dialog for a modern dark-mode dashboard UI. Zero runtime dependencies — only @aws-sdk peer deps remain.
