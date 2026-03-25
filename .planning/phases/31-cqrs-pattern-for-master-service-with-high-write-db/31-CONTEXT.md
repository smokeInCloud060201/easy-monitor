# Phase 31: CQRS Write/Read Separation - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement CQRS pattern in `master-service` to separate the write path (gRPC ingestion from node-agents) from the read path (HTTP API for dashboard). Replace the current broadcast channel with high-throughput buffered ingestion, add ClickHouse materialized views for read-optimized queries, and restructure the codebase into clear write/read modules.

</domain>

<decisions>
## Implementation Decisions

### Write-Path Buffering Strategy
- **In-process ring buffer + batch writer** — replace `broadcast::channel(1024)` with high-capacity `tokio::mpsc`
- **Separate `mpsc` channels per data type** — dedicated channels and writer tasks for logs, traces, and metrics independently. Prevents one data type (e.g., trace storms) from blocking writes of another
- **Size OR time flush trigger** — flush at 1000 rows OR 2 seconds, whichever comes first. Each data type can have independent thresholds tuned to its volume characteristics
- **Drop-oldest backpressure** — bounded channels; when full, drop oldest events and log warning with dropped count. gRPC ingestion is never blocked. System stability prioritized over completeness

### Read/Write Process Split
- **Module-level separation** — keep one binary, but refactor into clearly separated `write_path` and `read_path` modules. Write path gets dedicated Tokio task pool. Zero deployment overhead change
- **Separate ClickHouse connection pools** — write pool optimized for bulk inserts (fewer connections, larger timeouts). Read pool optimized for concurrent dashboard queries (more connections, shorter timeouts). Full isolation between ingestion and query traffic

### Data Synchronization (Write → Read)
- **ClickHouse materialized views** — define MVs that auto-aggregate raw ingestion tables into read-optimized summary tables. Zero application-level sync code; ClickHouse handles projection natively
- **Per-minute rollup granularity** — MVs aggregate per service per minute: request counts, error rates, p50/p95/p99 latencies, log counts by severity level. Covers ~90% of dashboard queries. Raw tables remain accessible for drill-down

### Metrics Handling
- **ClickHouse MVs are the metrics engine** — no separate in-memory metrics service. Read-path API simply queries pre-aggregated MV tables. Dashboard receives pre-computed metrics, eliminating client-side JS aggregation

### Claude's Discretion
- Exact `mpsc` channel capacity per data type
- ClickHouse MV SQL definitions and table engines (AggregatingMergeTree vs SummingMergeTree)
- Connection pool sizing and timeout values
- Internal error types and retry logic for failed batch inserts
- Tokio task pool configuration for write path

</decisions>

<specifics>
## Specific Ideas

- The flush trigger (1000 rows / 2s) should be configurable per data type — traces likely need higher row thresholds than logs
- Dropped event warnings should include a count so operators can size channels appropriately
- Dashboard queries should NEVER hit raw append tables directly — always go through MVs or summary tables

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `master-service/src/grpc/server.rs`: Existing gRPC handlers — will become the write-path entry point
- `master-service/src/api/`: Existing axum HTTP routes — will become the read-path module
- `master-service/src/clickhouse/`: ClickHouse client — split into write-pool and read-pool configurations

### Established Patterns
- `Event` enum in event system — will be decomposed into per-type channel messages
- `broadcast::channel(1024)` pattern — replaced by per-type `mpsc::channel` with higher capacity
- Existing 3-second flush interval in batch writer — replaced by size-OR-time trigger

### Integration Points
- gRPC `ingest_*` handlers → write-path mpsc senders
- Write-path batch writer tasks → ClickHouse raw tables (INSERT)
- ClickHouse MVs → summary tables (automatic, no code needed)
- Read-path axum handlers → ClickHouse summary tables (SELECT)
- Dashboard API calls → read-path HTTP endpoints

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-cqrs-write-read-separation*
*Context gathered: 2026-03-25*
