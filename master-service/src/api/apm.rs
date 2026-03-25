use axum::{extract::{State, Path, Query}, Json};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

use super::ApiState;
use crate::storage::CH_URL;

// ─── Service List ───

#[derive(Serialize)]
pub struct ServicesResponse {
    pub services: Vec<String>,
}

pub async fn get_services(State(state): State<ApiState>) -> Json<ServicesResponse> {
    let mut services = HashSet::new();
    
    // In-memory metrics
    for entry in state.latest_metrics.iter() {
        let key = entry.key();
        if key.starts_with("apm.") {
            let parts: Vec<&str> = key[4..].split(':').collect();
            if !parts.is_empty() {
                services.insert(parts[0].to_string());
            }
        }
    }

    // Also query ClickHouse for services in RED metrics
    let red_query = "SELECT DISTINCT service FROM easy_monitor_red_metrics FORMAT JSON";
    let red_url = format!("{}\u{0026}query={}", CH_URL, urlencoding::encode(red_query));
    if let Ok(res) = state.read_pool.client.get(&red_url).send().await {
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

    // Also query ClickHouse for services in traces
    let trace_query = "SELECT DISTINCT service FROM easy_monitor_traces FORMAT JSON";
    let trace_url = format!("{}\u{0026}query={}", CH_URL, urlencoding::encode(trace_query));
    if let Ok(res) = state.read_pool.client.get(&trace_url).send().await {
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

    let mut services_vec: Vec<String> = services.into_iter().collect();
    services_vec.sort();

    Json(ServicesResponse { services: services_vec })
}

// ─── Resource List (Enhanced with RED metrics) ───

#[derive(Serialize)]
pub struct ResourceWithMetrics {
    pub resource: String,
    pub requests: f64,
    pub errors: f64,
    pub avg_duration_ms: f64,
    pub p95_duration_ms: f64,
    pub error_rate: f64,
}

#[derive(Serialize)]
pub struct ResourcesResponse {
    pub service: String,
    pub resources: Vec<ResourceWithMetrics>,
}

pub async fn get_resources(State(state): State<ApiState>, Path(service_name): Path<String>) -> Json<ResourcesResponse> {
    // First try ClickHouse for rich metrics
    let query = format!(
        "SELECT resource, sum(requests) as total_requests, sum(errors) as total_errors, \
         avg(duration_avg) as avg_duration, max(duration_p95) as p95_duration \
         FROM easy_monitor_red_metrics WHERE service = '{}' \
         GROUP BY resource ORDER BY total_requests DESC FORMAT JSON",
        service_name.replace('\'', "")
    );
    let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(&query));

    if let Ok(res) = state.read_pool.client.get(&ch_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                if !data.is_empty() {
                    let resources: Vec<ResourceWithMetrics> = data.iter().filter_map(|row| {
                        let resource = row.get("resource")?.as_str()?.to_string();
                        let requests = parse_f64(row, "total_requests");
                        let errors = parse_f64(row, "total_errors");
                        let avg_dur = parse_f64(row, "avg_duration");
                        let p95_dur = parse_f64(row, "p95_duration");
                        let error_rate = if requests > 0.0 { (errors / requests) * 100.0 } else { 0.0 };

                        Some(ResourceWithMetrics {
                            resource, requests, errors,
                            avg_duration_ms: avg_dur,
                            p95_duration_ms: p95_dur,
                            error_rate,
                        })
                    }).collect();

                    if !resources.is_empty() {
                        return Json(ResourcesResponse { service: service_name, resources });
                    }
                }
            }
        }
    }

    // Fallback: derive from in-memory metrics
    let mut resource_set = HashSet::new();
    for entry in state.latest_metrics.iter() {
        let key = entry.key();
        let prefix = format!("apm.{}:", service_name);
        if key.starts_with(&prefix) {
            let remainder = &key[prefix.len()..];
            let parts: Vec<&str> = remainder.split(':').collect();
            if !parts.is_empty() {
                resource_set.insert(parts[0].to_string());
            }
        }
    }

    let resources: Vec<ResourceWithMetrics> = resource_set.into_iter().map(|resource| {
        let base = format!("apm.{}:{}", service_name, resource);
        let requests = state.latest_metrics.get(&format!("{}:rate", base)).map(|r| *r.value()).unwrap_or(0.0);
        let errors = state.latest_metrics.get(&format!("{}:error", base)).map(|r| *r.value()).unwrap_or(0.0);
        let duration_sum = state.latest_metrics.get(&format!("{}:duration_sum", base)).map(|r| *r.value()).unwrap_or(0.0);
        let avg_duration_ms = if requests > 0.0 { duration_sum / requests } else { 0.0 };
        let error_rate = if requests > 0.0 { (errors / requests) * 100.0 } else { 0.0 };

        ResourceWithMetrics {
            resource, requests, errors,
            avg_duration_ms,
            p95_duration_ms: avg_duration_ms * 1.5, // approx when no ClickHouse data
            error_rate,
        }
    }).collect();

    Json(ResourcesResponse { service: service_name, resources })
}

// ─── Service Summary (Time-Series RED) ───

#[derive(Serialize)]
pub struct RedTimePoint {
    pub timestamp: i64,
    pub requests: f64,
    pub errors: f64,
    pub avg_duration: f64,
    pub p95_duration: f64,
    pub p99_duration: f64,
}

#[derive(Serialize)]
pub struct ServiceSummaryResponse {
    pub service: String,
    pub total_requests: f64,
    pub total_errors: f64,
    pub avg_duration_ms: f64,
    pub p95_duration_ms: f64,
    pub p99_duration_ms: f64,
    pub timeseries: Vec<RedTimePoint>,
}

#[derive(Deserialize)]
pub struct SummaryQuery {
    pub from: Option<String>,  // duration like "1h", "6h", "24h"
}

pub async fn get_service_summary(
    State(state): State<ApiState>,
    Path(service_name): Path<String>,
    Query(params): Query<SummaryQuery>,
) -> Json<ServiceSummaryResponse> {
    let hours = parse_duration_hours(&params.from.unwrap_or_else(|| "1h".to_string()));
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    let from_ms = now_ms - (hours * 3600 * 1000);

    let query = format!(
        "SELECT timestamp, sum(requests) as requests, sum(errors) as errors, \
         avg(duration_avg) as avg_duration, max(duration_p95) as p95_duration, \
         max(duration_p99) as p99_duration \
         FROM easy_monitor_red_metrics \
         WHERE service = '{}' AND timestamp >= {} \
         GROUP BY timestamp ORDER BY timestamp ASC FORMAT JSON",
        service_name.replace('\'', ""), from_ms
    );
    let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(&query));

    let mut timeseries = Vec::new();
    let mut total_requests = 0.0f64;
    let mut total_errors = 0.0f64;
    let mut total_duration = 0.0f64;
    let mut total_count = 0.0f64;
    let mut max_p95 = 0.0f64;
    let mut max_p99 = 0.0f64;

    if let Ok(res) = state.read_pool.client.get(&ch_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    let ts = parse_i64(row, "timestamp");
                    let req = parse_f64(row, "requests");
                    let err = parse_f64(row, "errors");
                    let avg_d = parse_f64(row, "avg_duration");
                    let p95_d = parse_f64(row, "p95_duration");
                    let p99_d = parse_f64(row, "p99_duration");

                    timeseries.push(RedTimePoint {
                        timestamp: ts,
                        requests: req, errors: err,
                        avg_duration: avg_d, p95_duration: p95_d, p99_duration: p99_d,
                    });

                    total_requests += req;
                    total_errors += err;
                    total_duration += avg_d * req;
                    total_count += req;
                    if p95_d > max_p95 { max_p95 = p95_d; }
                    if p99_d > max_p99 { max_p99 = p99_d; }
                }
            }
        }
    }

    let avg_duration_ms = if total_count > 0.0 { total_duration / total_count } else { 0.0 };

    Json(ServiceSummaryResponse {
        service: service_name,
        total_requests,
        total_errors,
        avg_duration_ms,
        p95_duration_ms: max_p95,
        p99_duration_ms: max_p99,
        timeseries,
    })
}

// ─── Resource Summary ───

pub async fn get_resource_summary(
    State(state): State<ApiState>,
    Path((service_name, resource_name)): Path<(String, String)>,
    Query(params): Query<SummaryQuery>,
) -> Json<ServiceSummaryResponse> {
    let hours = parse_duration_hours(&params.from.unwrap_or_else(|| "1h".to_string()));
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    let from_ms = now_ms - (hours * 3600 * 1000);

    let query = format!(
        "SELECT timestamp, requests, errors, duration_avg as avg_duration, \
         duration_p95 as p95_duration, duration_p99 as p99_duration \
         FROM easy_monitor_red_metrics \
         WHERE service = '{}' AND resource = '{}' AND timestamp >= {} \
         ORDER BY timestamp ASC FORMAT JSON",
        service_name.replace('\'', ""), resource_name.replace('\'', ""), from_ms
    );
    let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(&query));

    let mut timeseries = Vec::new();
    let mut total_requests = 0.0f64;
    let mut total_errors = 0.0f64;
    let mut total_duration = 0.0f64;
    let mut total_count = 0.0f64;
    let mut max_p95 = 0.0f64;
    let mut max_p99 = 0.0f64;

    if let Ok(res) = state.read_pool.client.get(&ch_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    let ts = parse_i64(row, "timestamp");
                    let req = parse_f64(row, "requests");
                    let err = parse_f64(row, "errors");
                    let avg_d = parse_f64(row, "avg_duration");
                    let p95_d = parse_f64(row, "p95_duration");
                    let p99_d = parse_f64(row, "p99_duration");

                    timeseries.push(RedTimePoint {
                        timestamp: ts,
                        requests: req, errors: err,
                        avg_duration: avg_d, p95_duration: p95_d, p99_duration: p99_d,
                    });

                    total_requests += req;
                    total_errors += err;
                    total_duration += avg_d * req;
                    total_count += req;
                    if p95_d > max_p95 { max_p95 = p95_d; }
                    if p99_d > max_p99 { max_p99 = p99_d; }
                }
            }
        }
    }

    let avg_duration_ms = if total_count > 0.0 { total_duration / total_count } else { 0.0 };

    Json(ServiceSummaryResponse {
        service: format!("{}/{}", service_name, resource_name),
        total_requests,
        total_errors,
        avg_duration_ms,
        p95_duration_ms: max_p95,
        p99_duration_ms: max_p99,
        timeseries,
    })
}

// ─── Service Map Topology ───

#[derive(Serialize)]
pub struct ServiceMapNode {
    pub service: String,
    pub total_requests: f64,
    pub error_rate: f64,
    pub avg_duration_ms: f64,
    pub p95_duration_ms: f64,
    pub status: String,
    pub node_type: String,
}

#[derive(Serialize)]
pub struct ServiceMapEdge {
    pub source: String,
    pub target: String,
    pub requests: f64,
    pub error_rate: f64,
    pub avg_duration_ms: f64,
}

#[derive(Serialize)]
pub struct ServiceMapResponse {
    pub nodes: Vec<ServiceMapNode>,
    pub edges: Vec<ServiceMapEdge>,
}

#[derive(Deserialize)]
pub struct ServiceMapQuery {
    pub from: Option<String>,
}

fn infer_node_type(service: &str) -> String {
    let s = service.to_lowercase();
    if s.contains("redis") || s.contains("cache") || s.contains("memcache") {
        "cache".to_string()
    } else if s.contains("postgres") || s.contains("mysql") || s.contains("mongo") || s.contains("clickhouse") || s.contains("database") || s.contains("db") {
        "database".to_string()
    } else if s.contains("external") || s.contains("http") || s.contains("third-party") || s.contains("stripe") || s.contains("twilio") {
        "external".to_string()
    } else {
        "service".to_string()
    }
}

fn infer_status(error_rate: f64) -> String {
    if error_rate > 10.0 { "error".to_string() }
    else if error_rate > 5.0 { "warning".to_string() }
    else { "healthy".to_string() }
}

pub async fn get_service_map(
    State(state): State<ApiState>,
    Query(params): Query<ServiceMapQuery>,
) -> Json<ServiceMapResponse> {
    let hours = parse_duration_hours(&params.from.unwrap_or_else(|| "1h".to_string()));
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    let from_ms = now_ms - (hours * 3600 * 1000);

    let mut edges = Vec::new();
    let mut node_set = HashSet::new();

    // Derive edges from trace parent-child span joins
    let edge_query = format!(
        "SELECT \
            parent.service as source, \
            child.service as target, \
            count() as requests, \
            countIf(child.error > 0) * 100.0 / count() as error_rate, \
            avg(child.duration) as avg_duration \
         FROM easy_monitor_traces AS child \
         INNER JOIN easy_monitor_traces AS parent \
            ON child.parent_id = parent.span_id AND child.trace_id = parent.trace_id \
         WHERE child.service != parent.service \
            AND child.timestamp >= {} \
         GROUP BY source, target \
         ORDER BY requests DESC \
         FORMAT JSON",
        from_ms
    );
    let edge_url = format!("{}&query={}", CH_URL, urlencoding::encode(&edge_query));

    if let Ok(res) = state.read_pool.client.get(&edge_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    let source = row.get("source").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let target = row.get("target").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if !source.is_empty() && !target.is_empty() {
                        node_set.insert(source.clone());
                        node_set.insert(target.clone());
                        edges.push(ServiceMapEdge {
                            source,
                            target,
                            requests: parse_f64(row, "requests"),
                            error_rate: parse_f64(row, "error_rate"),
                            avg_duration_ms: parse_f64(row, "avg_duration"),
                        });
                    }
                }
            }
        }
    }

    // Build nodes with RED metrics
    let mut nodes = Vec::new();
    if !node_set.is_empty() {
        let services_list: Vec<String> = node_set.iter().map(|s| format!("'{}'", s.replace('\'', ""))).collect();
        let node_query = format!(
            "SELECT \
                service, \
                sum(requests) as total_requests, \
                sum(errors) as total_errors, \
                avg(duration_avg) as avg_duration, \
                max(duration_p95) as p95_duration \
             FROM easy_monitor_red_metrics \
             WHERE service IN ({}) AND timestamp >= {} \
             GROUP BY service \
             FORMAT JSON",
            services_list.join(","), from_ms
        );
        let node_url = format!("{}&query={}", CH_URL, urlencoding::encode(&node_query));

        if let Ok(res) = state.read_pool.client.get(&node_url).send().await {
            if let Ok(json_res) = res.json::<Value>().await {
                if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                    for row in data {
                        let service = row.get("service").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let total_req = parse_f64(row, "total_requests");
                        let total_err = parse_f64(row, "total_errors");
                        let error_rate = if total_req > 0.0 { (total_err / total_req) * 100.0 } else { 0.0 };
                        nodes.push(ServiceMapNode {
                            node_type: infer_node_type(&service),
                            status: infer_status(error_rate),
                            service,
                            total_requests: total_req,
                            error_rate,
                            avg_duration_ms: parse_f64(row, "avg_duration"),
                            p95_duration_ms: parse_f64(row, "p95_duration"),
                        });
                    }
                }
            }
        }

        // Add any nodes from edges that didn't have RED metrics
        let existing: HashSet<String> = nodes.iter().map(|n| n.service.clone()).collect();
        for svc in &node_set {
            if !existing.contains(svc) {
                nodes.push(ServiceMapNode {
                    service: svc.clone(),
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

    // Also include services from RED metrics that have no cross-service edges
    let standalone_query = format!(
        "SELECT DISTINCT service FROM easy_monitor_red_metrics WHERE timestamp >= {} FORMAT JSON",
        from_ms
    );
    let standalone_url = format!("{}\u{0026}query={}", CH_URL, urlencoding::encode(&standalone_query));
    if let Ok(res) = state.read_pool.client.get(&standalone_url).send().await {
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

    Json(ServiceMapResponse { nodes, edges })
}

// ─── Error Summary ───

#[derive(Serialize)]
pub struct ErrorEntry {
    pub name: String,
    pub resource: String,
    pub count: u64,
    pub last_seen: String,
}

#[derive(Serialize)]
pub struct ErrorSummaryResponse {
    pub service: String,
    pub errors: Vec<ErrorEntry>,
}

pub async fn get_service_errors(
    State(state): State<ApiState>,
    Path(service_name): Path<String>,
) -> Json<ErrorSummaryResponse> {
    let svc = service_name.replace('\'', "");
    let mut errors = Vec::new();

    // 1) Direct errors: spans owned by this service with error > 0
    let direct_query = format!(
        "SELECT name, resource, count() as cnt, max(timestamp) as last_ts \
         FROM easy_monitor_traces \
         WHERE service = '{}' AND error > 0 \
         GROUP BY name, resource ORDER BY cnt DESC LIMIT 50 FORMAT JSON",
        svc
    );
    let direct_url = format!("{}&query={}", CH_URL, urlencoding::encode(&direct_query));

    if let Ok(res) = state.read_pool.client.get(&direct_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    let ts = parse_i64(row, "last_ts");
                    let cnt = row.get("cnt")
                        .and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok())
                        .or_else(|| row.get("cnt").and_then(|v| v.as_u64()))
                        .unwrap_or(0);
                    errors.push(ErrorEntry {
                        name: row.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        resource: row.get("resource").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        count: cnt,
                        last_seen: chrono::DateTime::from_timestamp_millis(ts)
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_default(),
                    });
                }
            }
        }
    }

    // 2) Inbound errors: caller spans that target this service and have error > 0
    //    This catches cases where order-service calls inventory-service and gets a 500,
    //    recording the error on the client-side span (order-service owner) but the
    //    server-side span (inventory-service) doesn't have error flag set.
    let inbound_query = format!(
        "SELECT caller.name as name, caller.resource as resource, \
         count() as cnt, max(caller.timestamp) as last_ts \
         FROM easy_monitor_traces AS caller \
         INNER JOIN easy_monitor_traces AS callee \
            ON callee.parent_id = caller.span_id AND callee.trace_id = caller.trace_id \
         WHERE callee.service = '{svc}' AND caller.service != '{svc}' AND caller.error > 0 \
         GROUP BY name, resource ORDER BY cnt DESC LIMIT 50 FORMAT JSON",
        svc = svc
    );
    let inbound_url = format!("{}&query={}", CH_URL, urlencoding::encode(&inbound_query));

    if let Ok(res) = state.read_pool.client.get(&inbound_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    let ts = parse_i64(row, "last_ts");
                    let cnt = row.get("cnt")
                        .and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok())
                        .or_else(|| row.get("cnt").and_then(|v| v.as_u64()))
                        .unwrap_or(0);
                    let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let resource = row.get("resource").and_then(|v| v.as_str()).unwrap_or("").to_string();

                    // Merge: if same name+resource already exists from direct errors, sum the counts
                    if let Some(existing) = errors.iter_mut().find(|e| e.name == name && e.resource == resource) {
                        existing.count += cnt;
                        let existing_ts = chrono::DateTime::parse_from_rfc3339(&existing.last_seen)
                            .map(|dt| dt.timestamp_millis()).unwrap_or(0);
                        if ts > existing_ts {
                            existing.last_seen = chrono::DateTime::from_timestamp_millis(ts)
                                .map(|dt| dt.to_rfc3339())
                                .unwrap_or_default();
                        }
                    } else {
                        errors.push(ErrorEntry {
                            name: format!("inbound · {}", name),
                            resource,
                            count: cnt,
                            last_seen: chrono::DateTime::from_timestamp_millis(ts)
                                .map(|dt| dt.to_rfc3339())
                                .unwrap_or_default(),
                        });
                    }
                }
            }
        }
    }

    // Sort by count descending
    errors.sort_by(|a, b| b.count.cmp(&a.count));

    Json(ErrorSummaryResponse { service: service_name, errors })
}

// ─── Latency Distribution ───

#[derive(Serialize)]
pub struct LatencyBucket {
    pub range_label: String,
    pub min_ms: f64,
    pub max_ms: f64,
    pub count: u64,
    pub percentage: f64,
}

#[derive(Serialize)]
pub struct LatencyDistributionResponse {
    pub service: String,
    pub buckets: Vec<LatencyBucket>,
    pub total_requests: u64,
    pub p50_ms: f64,
    pub p90_ms: f64,
    pub p95_ms: f64,
    pub p99_ms: f64,
}

pub async fn get_latency_distribution(
    State(state): State<ApiState>,
    Path(service_name): Path<String>,
    Query(params): Query<SummaryQuery>,
) -> Json<LatencyDistributionResponse> {
    let hours = parse_duration_hours(&params.from.unwrap_or_else(|| "1h".to_string()));
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    let from_ms = now_ms - (hours * 3600 * 1000);

    let query = format!(
        "SELECT \
            countIf(duration < 10) as b_0_10, \
            countIf(duration >= 10 AND duration < 50) as b_10_50, \
            countIf(duration >= 50 AND duration < 100) as b_50_100, \
            countIf(duration >= 100 AND duration < 250) as b_100_250, \
            countIf(duration >= 250 AND duration < 500) as b_250_500, \
            countIf(duration >= 500 AND duration < 1000) as b_500_1000, \
            countIf(duration >= 1000) as b_1000_plus, \
            count() as total, \
            quantile(0.5)(duration) as p50, \
            quantile(0.9)(duration) as p90, \
            quantile(0.95)(duration) as p95, \
            quantile(0.99)(duration) as p99 \
         FROM easy_monitor_traces \
         WHERE service = '{}' AND timestamp >= {} \
         FORMAT JSON",
        service_name.replace('\'', ""), from_ms
    );
    let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(&query));

    if let Ok(res) = state.read_pool.client.get(&ch_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()).and_then(|a| a.first()) {
                let total = data.get("total").and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok())
                    .or_else(|| data.get("total").and_then(|v| v.as_u64())).unwrap_or(0);
                if total > 0 {
                    let ranges = vec![
                        ("0-10ms", 0.0, 10.0, "b_0_10"),
                        ("10-50ms", 10.0, 50.0, "b_10_50"),
                        ("50-100ms", 50.0, 100.0, "b_50_100"),
                        ("100-250ms", 100.0, 250.0, "b_100_250"),
                        ("250-500ms", 250.0, 500.0, "b_250_500"),
                        ("500ms-1s", 500.0, 1000.0, "b_500_1000"),
                        ("1s+", 1000.0, 10000.0, "b_1000_plus"),
                    ];
                    let buckets: Vec<LatencyBucket> = ranges.iter().map(|(label, min, max, field)| {
                        let count = data.get(*field).and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok())
                            .or_else(|| data.get(*field).and_then(|v| v.as_u64())).unwrap_or(0);
                        LatencyBucket {
                            range_label: label.to_string(),
                            min_ms: *min, max_ms: *max, count,
                            percentage: (count as f64 / total as f64) * 100.0,
                        }
                    }).collect();

                    return Json(LatencyDistributionResponse {
                        service: service_name,
                        buckets, total_requests: total,
                        p50_ms: parse_f64(data, "p50"),
                        p90_ms: parse_f64(data, "p90"),
                        p95_ms: parse_f64(data, "p95"),
                        p99_ms: parse_f64(data, "p99"),
                    });
                }
            }
        }
    }

    Json(LatencyDistributionResponse {
        service: service_name, buckets: Vec::new(), total_requests: 0,
        p50_ms: 0.0, p90_ms: 0.0, p95_ms: 0.0, p99_ms: 0.0,
    })
}

// ─── Service Dependencies ───

#[derive(Serialize)]
pub struct ServiceDependency {
    pub service: String,
    pub direction: String,
    pub requests: f64,
    pub error_rate: f64,
    pub avg_duration_ms: f64,
}

#[derive(Serialize)]
pub struct ServiceDependenciesResponse {
    pub service: String,
    pub upstream: Vec<ServiceDependency>,
    pub downstream: Vec<ServiceDependency>,
}

pub async fn get_service_dependencies(
    State(state): State<ApiState>,
    Path(service_name): Path<String>,
    Query(params): Query<SummaryQuery>,
) -> Json<ServiceDependenciesResponse> {
    let hours = parse_duration_hours(&params.from.unwrap_or_else(|| "1h".to_string()));
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    let from_ms = now_ms - (hours * 3600 * 1000);
    let svc = service_name.replace('\'', "");

    let mut upstream = Vec::new();
    let mut downstream = Vec::new();

    // Upstream: services that call this service
    let up_query = format!(
        "SELECT parent.service as caller, count() as requests, \
         countIf(child.error > 0) * 100.0 / count() as error_rate, \
         avg(child.duration) as avg_duration \
         FROM easy_monitor_traces AS child \
         INNER JOIN easy_monitor_traces AS parent \
            ON child.parent_id = parent.span_id AND child.trace_id = parent.trace_id \
         WHERE child.service = '{}' AND parent.service != '{}' AND child.timestamp >= {} \
         GROUP BY caller ORDER BY requests DESC LIMIT 10 FORMAT JSON",
        svc, svc, from_ms
    );
    let up_url = format!("{}&query={}", CH_URL, urlencoding::encode(&up_query));
    if let Ok(res) = state.read_pool.client.get(&up_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    let svc_name = row.get("caller").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if !svc_name.is_empty() {
                        upstream.push(ServiceDependency {
                            service: svc_name, direction: "upstream".to_string(),
                            requests: parse_f64(row, "requests"),
                            error_rate: parse_f64(row, "error_rate"),
                            avg_duration_ms: parse_f64(row, "avg_duration"),
                        });
                    }
                }
            }
        }
    }

    // Downstream: services this service calls
    let down_query = format!(
        "SELECT child.service as callee, count() as requests, \
         countIf(child.error > 0) * 100.0 / count() as error_rate, \
         avg(child.duration) as avg_duration \
         FROM easy_monitor_traces AS child \
         INNER JOIN easy_monitor_traces AS parent \
            ON child.parent_id = parent.span_id AND child.trace_id = parent.trace_id \
         WHERE parent.service = '{}' AND child.service != '{}' AND child.timestamp >= {} \
         GROUP BY callee ORDER BY requests DESC LIMIT 10 FORMAT JSON",
        svc, svc, from_ms
    );
    let down_url = format!("{}&query={}", CH_URL, urlencoding::encode(&down_query));
    if let Ok(res) = state.read_pool.client.get(&down_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    let svc_name = row.get("callee").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if !svc_name.is_empty() {
                        downstream.push(ServiceDependency {
                            service: svc_name, direction: "downstream".to_string(),
                            requests: parse_f64(row, "requests"),
                            error_rate: parse_f64(row, "error_rate"),
                            avg_duration_ms: parse_f64(row, "avg_duration"),
                        });
                    }
                }
            }
        }
    }


    Json(ServiceDependenciesResponse { service: service_name, upstream, downstream })
}

// ─── Helpers ───

fn parse_f64(row: &Value, field: &str) -> f64 {
    row.get(field)
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .or_else(|| row.get(field).and_then(|v| v.as_f64()))
        .unwrap_or(0.0)
}

fn parse_i64(row: &Value, field: &str) -> i64 {
    row.get(field)
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<i64>().ok())
        .or_else(|| row.get(field).and_then(|v| v.as_i64()))
        .unwrap_or(0)
}

fn parse_duration_hours(s: &str) -> i64 {
    let s = s.trim().to_lowercase();
    if s.ends_with('h') {
        s[..s.len()-1].parse().unwrap_or(1)
    } else if s.ends_with('d') {
        s[..s.len()-1].parse::<i64>().unwrap_or(1) * 24
    } else {
        1
    }
}
