# Phase 51 Research: Service Topology Graph Generation

## Objective
Derive a directed graph (caller -> callee) accurately modeling service request flows based directly on the distributed trace boundaries recorded inside the ClickHouse repository. 

## Technical Considerations
The OpenTelemetry standard implicitly constructs tree topologies via integer boundaries where:
`span A (service src)` acts as the entry.
`span B (service dst)` carries `parent_id` == `span A.span_id`.

To resolve this natively inside the Master Service without degrading realtime ingestion, we perform asynchronous analytical queries against the `traces` table in ClickHouse.

```sql
SELECT 
    source,
    target,
    count() AS call_count,
    avg(duration) AS avg_duration_ns,
    countIf(error > 0) AS error_count
FROM (
    SELECT 
        a.service AS source,
        b.service AS target,
        b.duration AS duration,
        b.error AS error
    FROM traces a
    JOIN traces b ON a.trace_id = b.trace_id AND a.span_id = b.parent_id
    WHERE a.service != b.service AND a.timestamp >= now() - INTERVAL 1 HOUR
)
GROUP BY source, target;
```
This query securely calculates identical topologies mapping exact traffic constraints implicitly derived from standard trace propagations. 
The Axum router will expose `GET /api/apm/topology` natively returning JSON matrices.
