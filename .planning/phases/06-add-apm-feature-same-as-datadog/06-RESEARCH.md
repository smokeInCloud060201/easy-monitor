# Phase 6: APM Feature (Datadog-style) — Research

## RESEARCH COMPLETE

## Current State Analysis

### What Exists

| Component | Location | Capability |
|-----------|----------|------------|
| RED Metrics Engine | `master-service/src/processors/trace_metrics.rs` | Aggregates rate/error/duration from spans every 10s, publishes as `apm.{service}:{resource}:{metric}` |
| Service/Resource List API | `master-service/src/api/apm.rs` | Derives active services & resources from in-memory RED metric keys |
| RED Metrics Query API | `master-service/src/api/queries.rs` → `query_metrics` | Returns latest rate/error_count/duration_sum for a service+resource pair |
| Trace Query API | `master-service/src/api/queries.rs` → `query_traces` | **MOCK ONLY** — returns hardcoded spans, does NOT query ClickHouse |
| ClickHouse Writer | `master-service/src/storage/clickhouse.rs` | Batches logs + spans to `easy_monitor_traces` table every 3s |
| Service Catalog UI | `dashboard/src/pages/APMCatalog.tsx` | Grid of service cards showing aggregate RED metrics |
| Trace Explorer UI | `dashboard/src/pages/TraceExplorer.tsx` | Manual trace-ID search → flat span list |
| Trace Detail UI | `dashboard/src/pages/TraceDetail.tsx` | Span waterfall + correlated logs |
| API Client | `dashboard/src/lib/api.ts` | `fetchTrace`, `fetchLogs`, `fetchMetrics` |

### ClickHouse Schema (already in place)

```sql
-- easy_monitor_traces
trace_id String, span_id String, parent_id String,
service String, name String, resource String,
error Int8, duration Int64, timestamp Int64
ORDER BY (service, timestamp)
```

### What's Missing vs Datadog APM

1. **Service Detail Page** — Datadog: click a service → see time-series RED charts, resource table, error breakdown. We have: nothing (cards only).
2. **Resource-Level Drill-Down** — Datadog: click a resource → see endpoint-level RED charts + trace samples. We have: nothing.
3. **Trace Search/List** — Datadog: filter traces by service, resource, status, duration. We have: only manual trace-ID input with mock backend.
4. **Real ClickHouse Trace Queries** — `query_traces` returns hardcoded spans. The data IS stored in ClickHouse but never read.
5. **Time-Series RED Metrics** — Engine publishes only latest snapshot. No historical data for charts. Need a `easy_monitor_red_metrics` time-series table.
6. **Latency Percentiles** — Datadog shows p50/p75/p95/p99. We store raw durations but never compute percentiles.
7. **Error Tracking** — No error-specific views, grouping, or trends.

## Architecture Decisions

### Time-Series RED Storage
- Add `easy_monitor_red_metrics` ClickHouse table: `(service, resource, timestamp, rate, errors, duration_sum, duration_p50, duration_p95, duration_p99, count)`
- The existing `trace_metrics.rs` already computes aggregates every 10s — extend it to also persist each window to ClickHouse
- Frontend queries this table for time-series charts

### Real Trace Queries
- Replace mock `query_traces` with actual ClickHouse queries
- Add `list_traces` endpoint: filter by service/resource/status/min_duration, paginated, returns trace summaries (root span info + span count + duration)

### Frontend Architecture
- **Service Detail Page** (`/apm/services/:name`): time-series charts (rate, errors, latency) + resource table + recent traces
- **Resource Detail Page** (`/apm/services/:name/resources/:resource`): endpoint-level RED charts + trace samples
- **Trace List/Search** (enhance existing TraceExplorer): filter bar + paginated trace list → click to waterfall
- Use lightweight charting (recharts, already evaluable via npm)

### API Endpoints Needed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/apm/services/:name/summary` | GET | RED summary + time-series for a service |
| `/apm/services/:name/resources` | GET | **ENHANCE**: return RED metrics per resource |
| `/apm/services/:name/resources/:resource/summary` | GET | RED time-series for specific resource |
| `/traces/search` | POST | Filter traces by service/resource/status/duration with pagination |
| `/traces/:traceId` | GET | Real ClickHouse trace fetch (replace mock) |
| `/apm/services/:name/errors` | GET | Error breakdown for a service |

## Risk Assessment
- **ClickHouse dependency**: All new features depend on ClickHouse being available. Current mock fallbacks mask this. Must handle gracefully.
- **Data volume**: Time-series table will grow. ClickHouse handles this well with proper TTL and partitioning.
- **Chart library**: Need to add recharts or similar. Must not bloat the dashboard bundle.
