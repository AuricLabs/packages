---
'@auriclabs/roles': major
---

Preserve the exact case and whitespace of nonempty scope ID segments when parsing, serializing, and matching permissions, and export `SCOPE_ENCODING_VERSION = 2` for snapshot provenance. Scope type names remain case-insensitive and trim surrounding whitespace. This is a security-sensitive behavior change: consumers must refresh or reject permission snapshots serialized by older versions and coordinate producer and reader upgrades before relying on exact-ID isolation.
