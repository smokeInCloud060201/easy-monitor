---
phase: 16
plan: 1
title: "Fix OTLP resource extraction and APM service list to show all services"
wave: 1
depends_on: []
files_modified:
  - node-agent/src/apm/mod.rs
  - master-service/src/api/apm.rs
autonomous: true
requirements_addressed: []
---

# Plan 1: Fix OTLP Resource Field and APM Service List

<objective>
Fix two issues preventing all services from appearing in the dashboard:
1. The node-agent hardcodes `resource: "otlp"` for all OTLP spans instead of extracting the actual HTTP route (e.g., `GET /api/checkout`). This prevents meaningful per-endpoint metrics.
2. The `get_services` APM endpoint only reads from in-memory metrics. It should ALSO query ClickHouse `easy_monitor_traces` for distinct services to provide a complete service list.
3. The service map `get_service_map` queries ClickHouse trace parent-child joins for edges, but also needs a fallback to show services from `easy_monitor_red_metrics` even when they have no cross-service edges.
</objective>

<tasks>

<task id="1" title="Fix OTLP span resource extraction in node-agent">
<read_first>
- node-agent/src/apm/mod.rs (full file, especially lines 38-80 where OTLP spans are translated)
</read_first>

<action>
In `node-agent/src/apm/mod.rs`, replace the hardcoded `resource: "otlp".to_string()` (line 74) with actual resource extraction logic:

```rust
// Extract resource from span name (which contains the HTTP route for auto-instrumented spans)
// For Express auto-instrumentation, span.name is like "GET /api/users" or "POST /api/checkout"
let resource = if span.name.is_empty() {
    "unknown".to_string()
} else {
    span.name.clone()
};
```

Then use `resource` in the Span struct:
```rust
resource,  // was: resource: "otlp".to_string()
```

This ensures the span's `resource` field contains the actual operation name (e.g., `GET /api/users`) instead of the generic "otlp" string, enabling per-endpoint RED metrics in the dashboard.
</action>

<acceptance_criteria>
- `node-agent/src/apm/mod.rs` does NOT contain `resource: "otlp".to_string()`
- `node-agent/src/apm/mod.rs` contains `resource` assignment using `span.name`
- `cargo build` in node-agent compiles without errors
</acceptance_criteria>
</task>

<task id="2" title="Add ClickHouse fallback for APM service list">
<read_first>
- master-service/src/api/apm.rs (lines 17-34, get_services function)
- master-service/src/storage/mod.rs (CH_URL constant)
</read_first>

<action>
Modify `get_services` in `master-service/src/api/apm.rs` to also query ClickHouse for distinct services from both `easy_monitor_traces` and `easy_monitor_red_metrics`:

After the existing in-memory lookup (lines 20-28), add:

```rust
// Also query ClickHouse for services that may only exist in persisted data
let ch_query = "SELECT DISTINCT service FROM easy_monitor_red_metrics FORMAT JSON";
let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(ch_query));
if let Ok(res) = state.ch_client.get(&ch_url).send().await {
    if let Ok(json_res) = res.json::<Value>().await {
        if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
            for row in data {
                if let Some(svc) = row.get("service").and_then(|v| v.as_str()) {
                    services.insert(svc.to_string());
                }
            }
        }
    }
}

// Also check traces table for services
let trace_query = "SELECT DISTINCT service FROM easy_monitor_traces FORMAT JSON";
let trace_url = format!("{}&query={}", CH_URL, urlencoding::encode(trace_query));
if let Ok(res) = state.ch_client.get(&trace_url).send().await {
    if let Ok(json_res) = res.json::<Value>().await {
        if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
            for row in data {
                if let Some(svc) = row.get("service").and_then(|v| v.as_str()) {
                    services.insert(svc.to_string());
                }
            }
        }
    }
}
```
</action>

<acceptance_criteria>
- `get_services` in `apm.rs` queries `easy_monitor_red_metrics` for distinct services
- `get_services` in `apm.rs` queries `easy_monitor_traces` for distinct services
- `get_services` merges in-memory and ClickHouse results into a single sorted list
- `cargo build` in master-service compiles without errors
</acceptance_criteria>
</task>

<task id="3" title="Add standalone service nodes to service map">
<read_first>
- master-service/src/api/apm.rs (lines 345-458, get_service_map function)
</read_first>

<action>
In `get_service_map`, AFTER the edge query and node-building logic (around line 454), add a fallback to include services that have RED metrics but no cross-service edges:

```rust
// Also include services from RED metrics that have no edges (standalone services)
let standalone_query = format!(
    "SELECT DISTINCT service FROM easy_monitor_red_metrics WHERE timestamp >= {} FORMAT JSON",
    from_ms
);
let standalone_url = format!("{}&query={}", CH_URL, urlencoding::encode(&standalone_query));
if let Ok(res) = state.ch_client.get(&standalone_url).send().await {
    if let Ok(json_res) = res.json::<Value>().await {
        if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
            let existing: HashSet<String> = nodes.iter().map(|n| n.service.clone()).collect();
            for row in data {
                if let Some(svc) = row.get("service").and_then(|v| v.as_str()) {
                    if !existing.contains(svc) {
                        nodes.push(ServiceMapNode {
                            service: svc.to_string(),
                            total_requests: 0.0,
                            error_rate: 0.0,
                            avg_duration_ms: 0.0,
                            p95_duration_ms: 0.0,
                            status: "healthy".to_string(),
                            node_type: infer_node_type(svc),
                        });
                    }
                }
            }
        }
    }
}
```
</action>

<acceptance_criteria>
- Service map query includes standalone services from `easy_monitor_red_metrics`
- Services without cross-service edges still appear as nodes
- `cargo build` compiles without errors
</acceptance_criteria>
</task>

</tasks>

<verification>

## must_haves
- [ ] OTLP span resource field contains actual operation name instead of "otlp"
- [ ] APM service list shows all services that have data in ClickHouse
- [ ] Service map shows services even when they have no inter-service edges
- [ ] No compilation errors in both node-agent and master-service

## Commands
```bash
cd node-agent && cargo build
cd master-service && cargo build
```

</verification>
