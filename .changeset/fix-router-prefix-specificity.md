---
"@auriclabs/sst-utils": patch
---

Fix route specificity sorting for prefix paths — shorter paths like `POST /subscriptions` no longer match before longer paths like `POST /subscriptions/platform-free`
