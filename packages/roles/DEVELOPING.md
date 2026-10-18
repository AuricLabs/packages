# Developing Roles

## Scope IDs are exact authority values

**Decision (2026-10-18):** In alternating `type:id` scope segments, normalize
the type name by trimming surrounding whitespace and lowercasing it. Preserve
every byte of each nonempty ID segment, including case and whitespace.
`agt_Case`, `agt_case`, and `agt_Case ` are different resources. Apply the same
rule in parsing, stringification, role hydration, ancestor checks, and ability
matching. Never trim an ID during permission checks or claim serialization.

An empty ID segment means that the scope has no specific ID; it remains the
existing wildcard-like grammar marker. Callers must validate that real
authority IDs are nonempty. `*` and `**` remain pattern syntax for trusted
grants. Callers that accept a tenant-authored resource ID must also reject
colon, wildcard, and `{` / `}` template characters before building a scope.
A serialized claim from an older version may have lost the original ID case or
whitespace; it cannot be repaired by parsing or re-rooting the string.
See [EXACT_SCOPE_MIGRATION.md](EXACT_SCOPE_MIGRATION.md) before adopting this
major version.

### Decision history

- **2026-10-18:** Extended the exact-ID decision to preserve ID whitespace
  after a grant for `agt_Case ` was shown to authorize `agt_Case` through
  `parseScope`. Trimming IDs was rejected because it aliases distinct authority
  values; type spelling remains normalized for compatibility. The existing
  empty-ID sentinel remains because the scope grammar cannot represent an
  empty resource ID distinctly from an absent ID.
- **2026-10-18:** Replaced whole-scope case folding with exact ID segments
  after a grant for `agt_Case` was shown to authorize `agt_case`. Keeping the
  old encoding was rejected because a scope match cannot distinguish those
  resources after case is lost. A silent patch release was rejected because
  stored and cached claims require coordinated handling.
