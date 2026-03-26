---
wave: 1
depends_on: []
files_modified:
  - shared-proto/proto/traces.proto
  - shared-proto/src/traces.rs
  - master-service/src/storage/clickhouse.rs
autonomous: true
requirements: []
---

# Plan 01 - Protobuf schemas and ClickHouse DB 

<objective>
Update the shared Protobuf definitions to accommodate native Profiling data payloads. Update the ClickHouse definitions within the master-service to initialize `easy_monitor_topology_edges` and `easy_monitor_profiles` analytical tables for fast CQRS metric querying.
</objective>

## Tasks

<task>
<id>53-01-01</id>
<title>Update shared-proto Profile structures</title>
<action>
Add a new `Profile` message structure within `shared-proto/proto/traces.proto`. Extend the `SyncTracesRequest` (or create `SyncProfilesRequest` if separated) to accommodate transporting native flamegraphs. Update `shared-proto/src/traces.rs` and re-compile via `make build` inside the `shared-proto` directory to propagate the tonic Rust derivations.
</action>
<read_first>
- `shared-proto/proto/traces.proto`
- `shared-proto/src/traces.rs`
</read_first>
<acceptance_criteria>
- `shared-proto/proto/traces.proto` contains `message Profile`
- `cd shared-proto && cargo check` passes successfully without syntax errors
</acceptance_criteria>
</task>

<task>
<id>53-01-02</id>
<title>Add ClickHouse Topology and Profile tables</title>
<action>
Inside `master-service/src/storage/clickhouse.rs`, append two new `CREATE TABLE IF NOT EXISTS` queries to the `initialize_clickhouse` routine:
1. `easy_monitor_topology_edges` (columns: `parent_service String`, `child_service String`, `timestamp Int64`, `call_count UInt64`, `error_count UInt64`, `p95_latency Float64`) => Ordered by `(parent_service, child_service, timestamp)`
2. `easy_monitor_profiles` (columns: `service String`, `profile_type String`, `timestamp Int64`, `raw_data String`) => Ordered by `(service, timestamp)`
Execute these queries alongside the existing routines.
</action>
<read_first>
- `master-service/src/storage/clickhouse.rs`
</read_first>
<acceptance_criteria>
- `master-service/src/storage/clickhouse.rs` contains string `easy_monitor_topology_edges`
- `master-service/src/storage/clickhouse.rs` contains string `easy_monitor_profiles`
- `cd master-service && cargo check` passes.
</acceptance_criteria>
</task>

## Verification
- Run `cd shared-proto && cargo check` to confirm tonic bindings compile properly.
- Verify `master-service` compiles after modifying the ClickHouse routine.

<must_haves>
- [ ] `easy_monitor_topology_edges` initialized in ClickHouse.
- [ ] Protobuf `Profile` structures safely generated in `shared-proto` Rust targets.
</must_haves>
