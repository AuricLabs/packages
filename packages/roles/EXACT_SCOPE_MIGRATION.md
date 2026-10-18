# Exact scope-ID migration

`@auriclabs/roles` previously lowercased every scope segment and trimmed ID
segments while parsing. This major release lowercases and trims only the
`type` segments, preserving every byte of each nonempty opaque `id` segment.
The old behavior can make a grant for `agent:agt_Case` authorize
`agent:agt_case`, or a grant for `agent:agt_Case ` authorize
`agent:agt_Case`; the new matcher treats all three as distinct.

An old serialized claim cannot reveal whether its lowercase or trimmed ID
came from another exact source. Upgrading the matcher alone is unsafe: an old
writer can still emit an alias, while an old reader can still collapse a new
exact claim. Do not publish or deploy this package as an isolated dependency
bump into a service that mints, caches, or checks scoped claims.

Before rollout, inventory durable role assignments and direct grants at their
exact source rows, plus token snapshots, session caches, queued claims, and
external plugin consumers. Identify case-fold collisions and damaged source
rows. Repair or quarantine ambiguous grants rather than guessing the owner.
Persist the exported `SCOPE_ENCODING_VERSION` on permission snapshots; never
infer it from claim text or reuse an unrelated permission-policy version. Fresh
claims must be generated from exact source IDs. Old snapshots with scoped IDs
must be re-resolved from authoritative rows or denied until refreshed;
re-rooting an already folded claim cannot restore its owner.
The constant labels new output; this package does not validate a caller's
snapshot version or retroactively identify old claims.

Upgrade every claim producer and reader, including background workers and
agent plugins, as a coordinated release. Drain old readers and old writers
before treating exact-ID isolation as active. During a mixed-version window,
restrict case- or whitespace-colliding resources or fail closed at the
boundary. Run end-to-end tests for grants on `agt_Case` and `agt_Case ` against
both IDs and `agt_case` through the real authorizer, middleware, role resolver,
and stored snapshot path.

Alfe has one known consumer-side fold outside this package:
`packages-internal/api-core/src/middleware/require-permissions.ts` lowercases
string scope resolvers before comparing them with the org root. Change that
branch to the package's case-preserving `stringifyScope` as part of the
coordinated upgrade. Review any other local normalization of held or required
scope strings in downstream consumers; upgrading this package alone does not
remove those folds.

This package change does not migrate a database's case-folded physical keys.
Consumers must separately introduce versioned exact keys or enforce exact
stored-owner checks on reads and conditional writes, with collision repair.
Colon, wildcard, and `{` / `}` template characters remain scope syntax;
validate untrusted IDs before inserting them into scopes. Empty ID segments
still mean no specific ID in this grammar, so a real authority ID must be
nonempty. A whitespace-only ID is nonempty and remains distinct from a missing
ID; callers may reject such values in their domain-specific ID validation.

## Review evidence (2026-10-18)

The new allow, deny, role-hydration, parser, regex, and ancestor regression
cases failed against the former case-folding behavior. Four additional cases
proved that trimmed IDs could alias both grants and denials, and now pass with
exact ID whitespace. The full Roles suite passes 997 tests; package typecheck
and build pass. Lint retains one warning in unchanged test code. A separate
test-source TypeScript check still reports six errors in unchanged tests; it
reports none in the new exact-scope test. No Alfe fleet, persisted rows, or
plugin deployments were changed or inspected live. The release gate above
remains open.
