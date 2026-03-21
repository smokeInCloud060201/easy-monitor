# Phase 14: Filter out internal service logs and traces - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning
**Source:** Direct observation — logs page shows master-service and node-agent entries

<domain>
## Phase Boundary

Filter out logs and traces from internal infrastructure services (master-service, node-agent) at the ingress layer. These services are part of the monitoring platform itself and should not appear alongside application service data in the dashboard.

**Internal services to exclude:**
- `master-service` — the API/storage backend
- `node-agent` — the telemetry collection agent

</domain>

<decisions>
## Implementation Decisions

### Where to Filter
- Filter at **gRPC ingress** (`ingress/mod.rs`) before publishing to event bus
- This prevents internal data from entering ClickHouse, RED metrics, and alerts entirely
- Define exclusion list as a constant in `utils.rs` for reuse

### What to Filter
- Logs: exclude entries where `entry.service` matches an internal service name
- Traces: exclude spans where `span.service` matches an internal service name
- Metrics: keep all metrics (they don't have the same service field semantics)

</decisions>

<canonical_refs>
## Canonical References

- `master-service/src/ingress/mod.rs` — gRPC handlers, `sync_logs` (line 52), `sync_traces` (line 70)
- `shared-proto/proto/logs.proto` — `LogEntry.service` field
- `shared-proto/proto/traces.proto` — `Span.service` field

</canonical_refs>

---

*Phase: 14-filter-out-internal-service-logs-and-traces-master-service-node-agent*
