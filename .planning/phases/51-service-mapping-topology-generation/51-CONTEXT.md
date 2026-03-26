# Phase 51: Service Mapping & Topology Generation

## Objective
Dynamically discover and map inter-service dependencies (caller -> callee) strictly by correlating distributed trace parent-child span constraints inside the backend telemetry pipeline.

## Architectural Context
In earlier iterations, the roadmap placed this in the "Node agent backend" (which is now the lightweight Rust `node-agent` daemon). Since `master-service` (Rust) operates as the definitive data repository integrating directly with ClickHouse, topology derivation should happen at the database/master layer rather than stressing the node daemon edge buffers.

## Proposals for Topology Generation

### Method A: ClickHouse Native Traces JOIN
Because ClickHouse stores every span natively, we can extract directional edges purely over SQL:
```sql
SELECT 
    a.service AS source,
    b.service AS target,
    count() AS call_count,
    avg(b.duration) AS avg_latency_ns
FROM traces a
JOIN traces b ON a.trace_id = b.trace_id AND a.span_id = b.parent_id
WHERE a.service != b.service
GROUP BY source, target;
```
**Pros**: Zero code to maintain on the ingestion path. Highly dynamic over any chosen time window.
**Cons**: Repeated JOIN operations across massive `traces` tables may degrade performance under heavy APM loads without proper Materialized Views.

### Method B: Ingestion-Time Edge Detection (Master Service)
Modify `master-service/src/services/telemetry.rs` to track recent `trace_id` bounds in memory (using `moka` or a standard TTL cache cache). When a child span arrives, it pulls the parent's `service` from cache. If `parent.service != child.service`, an edge is recorded and written to an optimized ClickHouse `service_edges` table asynchronously.
**Pros**: Querying the topology becomes an instant `SELECT` statement globally scaling infinitely.
**Cons**: Requires managing distributed state locks parsing traces arriving out-of-order within the Rust Master Service.

## Implementation Path
I recommend **Method A** wrapped inside a ClickHouse **Materialized View** (or AggregatingMergeTree) matching `parent_id` == `span_id` over the primary `traces` shards. This guarantees optimal performance without bloating the `master-service` memory footprint parsing out-of-order batches.

The `master-service` will expose a `/api/topology` HTTP endpoint executing the aggregations, returning JSON Edge formats for future UI canvases.

_Awaiting user approval._
