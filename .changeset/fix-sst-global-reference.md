---
"@auriclabs/sst-utils": patch
---

Fix sst global reference error by creating Lambda via first api.route() call instead of new sst.aws.Function()
