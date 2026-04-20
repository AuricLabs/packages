---
"@auriclabs/sst-utils": patch
---

Fix CORS preflight failures in consolidated mode by registering individual method+path routes instead of `ANY /{proxy+}` catch-all. The catch-all intercepted OPTIONS requests, bypassing API Gateway's native CORS handling and causing 401 responses on preflight.
