# Phase 53: Update node-agent and master-service for agent infrastructure changes - Research

## Objective
Identify the architectural integration points necessary to update the `node-agent` and `master-service` telemetry pipelines to ingest and process the new data dimensions from Phase 45-52 updates (CQRS Topology, Native Profiling, and DB spanning).

## Findings

### 1. Data Transport Protocol (`shared-proto`)
- **Current State**: `traces.proto` contains `SyncTracesRequest` holding a `repeated Span spans`. `metrics.proto` handles temporal gauges and counters.
- **Required Changes**: As dictated by the `CONTEXT.md` decisions, we should reuse existing Protobufs. We will append a `repeated Profile profiles = 2;` array into `SyncTracesRequest` or `SyncMetricsRequest` (or keep it in a new sub-message) to transport flamegraph/pprof data without multiplexing a brand new gRPC service.
- **DB Spans / Metadata**: The `Span` message already contains `map<string, string> meta`. Database query tracking and standard OpenTelemetry attribute enrichment from the native agents will perfectly map into this existing `meta` dictionary.

### 2. ClickHouse Schema Enhancements (`master-service`)
- **Location**: `master-service/src/storage/clickhouse.rs`.
- **Topologies**: We need to define a new table `easy_monitor_topology_edges` to hold service-to-service links (e.g., `source_service`, `target_service`, `call_count`, `error_count`, `p95_latency`).
- **Profiles**: We need to define a new table `easy_monitor_profiles` to hold native profiling outputs (e.g., `service`, `timestamp`, `profile_type`, `raw_data`).

### 3. Topology Aggregation (CQRS)
- **Location**: `master-service/src/processors/trace_metrics.rs`.
- **Mechanism**: The background worker currently groups trace logs into RED metrics (Requests, Errors, Duration) per endpoint.
- **Update**: Inside the `EventBusRx` receiving loop for `Traces(spans)`, we must evaluate `parent_id`. If a span represents an RPC/HTTP client call (often tagged via HTTP instrumentation), we extract the caller and callee services to build a `Topology Edge`. This edge should be aggregated periodically and flushed into the new `topology` ClickHouse table.

### 4. Node Agent Adjustments
- **Location**: `node-agent/src/apm/` and `node-agent/src/forwarder/`.
- **Update**: `node-agent/src/wal/mod.rs` (the SLED database) needs to be capable of buffering `Profile` structures safely before the forwarder ships them to the `master-service` gRPC ingress.

## Validation Architecture
- Code compiles via `make build`.
- Polyglot Mock App testing: The `shipping-service` or `order-service` emits traces representing inter-service calls. The `master-service` must successfully aggregate these spans into rows within `easy_monitor_topology_edges`.
- ClickHouse DB queries confirm that topology graphs and profiling metadata are correctly parsed and saved.

## RESEARCH COMPLETE
