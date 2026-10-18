/**
 * Version of the scope-ID encoding used for newly serialized claims.
 * Version 1 lowercased IDs; version 2 preserves their exact case.
 * A version-1 claim cannot be upgraded without its authoritative source row.
 */
export const SCOPE_ENCODING_VERSION = 2 as const;
