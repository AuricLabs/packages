---
'@auriclabs/jobs': major
'@auriclabs/jobs-infra': major
---

Require an operator authorization policy and same-API Gateway authorizer for the hosted Jobs dashboard. The bundled UI now accepts fresh tokens only from a configured, exact-origin parent window; the API uses exact-site CORS and denies unauthenticated data/action routes.
