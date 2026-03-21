# Phase 12: Fix logs query parser — structured search syntax support - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning
**Source:** Direct investigation of reported bug

<domain>
## Phase Boundary

Fix the logs search bar to support structured query syntax like `service:order-service AND message:"test"`. Currently the entire search input is sent as a raw `keyword` which becomes a single `ILIKE '%...%'` on the `message` column only — ignoring field qualifiers entirely.

**What this phase delivers:**
1. A frontend query parser that decomposes structured queries into individual filter fields
2. Updated API call to send parsed fields as structured JSON (backend already supports `service`, `level`, `pod_id`, `trace_id`, `keyword` fields)
3. Search syntax including: `field:value`, quoted strings `field:"multi word"`, AND/OR operators, bare keywords (fallback to message search)

</domain>

<decisions>
## Implementation Decisions

### Query Parser Approach
- Parse on the **frontend** (TypeScript) — the backend already accepts structured filters
- Support fields: `service`, `level`, `pod_id`, `trace_id`, `host`, `source`, `namespace`, `message`
- Bare text (no field qualifier) → `keyword` (message ILIKE)
- Quoted values supported: `message:"connection timeout"`
- AND is implicit between terms; explicit AND/OR supported
- Unknown fields → treated as keyword search

### Backend Changes
- Add support for `host`, `source`, `namespace` filters in `build_logs_where_clauses` (currently missing)
- Pass parsed `keyword` separate from structured field filters
- Ensure histogram and fields endpoints also accept the parsed query structure

### Claude's Discretion
- Parser implementation details (recursive descent vs regex-based)
- Error handling for malformed queries
- Visual feedback for parsed query tokens in the search bar

</decisions>

<canonical_refs>
## Canonical References

### Backend Query Building
- `master-service/src/api/queries.rs` — `build_logs_where_clauses` function (line 280), `LogsQueryRequest` struct (line 244)

### Frontend Log Search
- `dashboard/src/pages/Logs.tsx` — Search bar, `handleSearch`, `filters` state
- `dashboard/src/lib/api.ts` — `fetchLogsEnhanced` function (line 116)

### Backend API Routes
- `master-service/src/api/mod.rs` — `/logs/query`, `/logs/histogram`, `/logs/fields` routes

</canonical_refs>

<specifics>
## Specific Ideas

- Follow GrayLog/Datadog query syntax conventions: `field:value`, `field:"quoted value"`, boolean operators
- The ClickHouse schema has columns: `service`, `level`, `pod_id`, `namespace`, `node_name`, `host`, `source`, `message`, `trace_id`, `span_id`
- Backend `LogsQueryRequest` already accepts: `keyword`, `service`, `level`, `pod_id`, `trace_id`, `from_ts`, `to_ts`

</specifics>

<deferred>
## Deferred Ideas

- Negation syntax (`-field:value`, `NOT field:value`)
- Regex syntax (`message:/pattern/`)
- Autocomplete suggestions for field names and values
- Query history / saved searches

</deferred>

---

*Phase: 12-fix-logs-query-parser-structured-search-syntax-support*
*Context gathered: 2026-03-21 via direct bug investigation*
