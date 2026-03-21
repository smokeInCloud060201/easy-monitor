# Phase 13: Sanitize sensitive data in trace span resource names - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning
**Source:** Direct observation of trace spans with dynamic IDs

<domain>
## Phase Boundary

Sanitize trace span resource names by replacing dynamic/sensitive tokens (numeric IDs, UUIDs, hex strings, transaction IDs) with `?` placeholder. This prevents high-cardinality metric keys and hides sensitive data from the dashboard UI.

**Example transformations:**
- `cache.GET txn:txn_1774095094` → `cache.GET txn:?`
- `SELECT * FROM users WHERE id = 42` → `SELECT * FROM users WHERE id = ?`
- `/api/users/12345/orders` → `/api/users/?/orders`
- `payment:pay_abc123def456` → `payment:?`

</domain>

<decisions>
## Implementation Decisions

### Sanitization Approach
- Apply sanitization at the **master-service ingestion layer** before ClickHouse write and RED metric computation
- Create a reusable `sanitize_resource` function
- Replace patterns: numeric sequences (3+ digits), hex/alphanum IDs (8+ chars with mixed letters/digits), UUID patterns, key:value-id patterns
- Keep the operation prefix (e.g., `cache.GET`, `SELECT`, `HTTP POST`)

### Where to Apply
- `storage/clickhouse.rs` — before writing `span.resource` to ClickHouse
- `processors/trace_metrics.rs` — before using `span.resource` as RED metric key
- Create utility in a shared location (new `utils.rs` or inline)

### Claude's Discretion
- Exact regex patterns for identifying dynamic tokens
- Whether to also sanitize `span.name` field (likely yes for consistency)

</decisions>

<canonical_refs>
## Canonical References

- `master-service/src/storage/clickhouse.rs` — ClickHouse writer, line 167 writes `span.resource`
- `master-service/src/processors/trace_metrics.rs` — RED metrics, line 44 uses `span.resource` as metric key
- `shared-proto/proto/traces.proto` — Span proto with `string resource = 6`

</canonical_refs>

---

*Phase: 13-sanitize-sensitive-data-in-trace-span-resource-names*
*Context gathered: 2026-03-21 via direct observation*
