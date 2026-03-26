---
wave: 2
depends_on: ["01"]
files_modified:
  - master-service/src/processors/trace_metrics.rs
autonomous: true
requirements: []
---

# Plan 02 - CQRS Topology Background Generator

<objective>
Update the Background Worker inside `master-service/src/processors/trace_metrics.rs` to aggregate trace parent-child ID maps spanning synchronous and asynchronous network bounds, saving them natively to the newly defined `easy_monitor_topology_edges` analytical view.
</objective>

## Tasks

<task>
<id>53-02-01</id>
<title>Extract edge pairings from HTTP Client Spans</title>
<action>
Modify `master-service/src/processors/trace_metrics.rs`. Track `Span` traces passing through the EventBus that have valid HTTP/RPC tags within their `meta` fields. Buffer `parent_service` and `child_service` map configurations inside a new `DashMap<String, TopologyBucket>` alongside RED metrics. 
Aggregate them precisely every 10 seconds.
</action>
<read_first>
- `master-service/src/processors/trace_metrics.rs`
</read_first>
<acceptance_criteria>
- `master-service/src/processors/trace_metrics.rs` contains a `TopologyBucket` structure.
- In-memory event processors push aggregated spans to ClickHouse `easy_monitor_topology_edges`.
- `cd master-service && cargo check` is successful.
</acceptance_criteria>
</task>

## Verification
- `cd master-service && cargo check`
- Validate the new CQRS metric paths properly execute ClickHouse insert JSON statements aligned to Plan 01's structure.

<must_haves>
- [ ] `TopologyBucket` aggregate groups spans accurately by 10s intervals.
- [ ] Topology metrics JSON correctly inserts to ClickHouse HTTP API endpoints.
</must_haves>
