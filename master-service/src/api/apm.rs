use axum::{extract::{State, Path, Query}, Json};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use tracing::error;

use super::ApiState;
use crate::storage::CH_URL;

// ─── Service List ───

#[derive(Serialize)]
pub struct ServicesResponse {
    pub services: Vec<String>,
}

pub async fn get_services(State(state): State<ApiState>) -> Json<ServicesResponse> {
    let mut services = HashSet::new();
    
    for entry in state.latest_metrics.iter() {
        let key = entry.key();
        if key.starts_with("apm.") {
            let parts: Vec<&str> = key[4..].split(':').collect();
            if !parts.is_empty() {
                services.insert(parts[0].to_string());
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

    if let Ok(res) = state.ch_client.get(&ch_url).send().await {
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

    if let Ok(res) = state.ch_client.get(&ch_url).send().await {
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

    if let Ok(res) = state.ch_client.get(&ch_url).send().await {
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
    let query = format!(
        "SELECT name, resource, count() as cnt, max(timestamp) as last_ts \
         FROM easy_monitor_traces \
         WHERE service = '{}' AND error > 0 \
         GROUP BY name, resource ORDER BY cnt DESC LIMIT 50 FORMAT JSON",
        service_name.replace('\'', "")
    );
    let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(&query));

    let mut errors = Vec::new();
    if let Ok(res) = state.ch_client.get(&ch_url).send().await {
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

    Json(ErrorSummaryResponse { service: service_name, errors })
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
