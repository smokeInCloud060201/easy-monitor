use axum::{extract::{State, Path, Query}, Json};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::ApiState;
use crate::storage::CH_URL;

// ─── Helpers ───

fn parse_f64(row: &Value, field: &str) -> f64 {
    row.get(field)
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .or_else(|| row.get(field).and_then(|v| v.as_f64()))
        .unwrap_or(0.0)
}

fn parse_u64(row: &Value, field: &str) -> u64 {
    row.get(field)
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<u64>().ok())
        .or_else(|| row.get(field).and_then(|v| v.as_u64()))
        .unwrap_or(0)
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

/// Supported database types derived from span name prefixes.
/// Extensible: add new types here as agents produce new span patterns.
const DB_TYPE_PATTERNS: &[(&str, &str)] = &[
    ("postgresql", "postgresql.query%"),
    ("redis", "redis.query%"),
    // Future:
    // ("mysql", "mysql.query%"),
    // ("mongodb", "mongodb.query%"),
];

fn db_like_pattern(db_type: &str) -> Option<&'static str> {
    DB_TYPE_PATTERNS.iter()
        .find(|(name, _)| *name == db_type)
        .map(|(_, pattern)| *pattern)
}

#[derive(Deserialize)]
pub struct TimeRangeQuery {
    pub from: Option<String>, // "1h", "6h", "24h", "7d"
}

// ─── GET /databases — List detected database types with metrics ───

#[derive(Serialize)]
pub struct DatabaseInfo {
    pub db_type: String,
    pub display_name: String,
    pub icon: String,
    pub total_queries: u64,
    pub error_count: u64,
    pub error_rate: f64,
    pub avg_latency_ms: f64,
    pub p95_latency_ms: f64,
    pub service_count: u64,
}

#[derive(Serialize)]
pub struct DatabasesResponse {
    pub databases: Vec<DatabaseInfo>,
}

pub async fn get_databases(
    State(state): State<ApiState>,
    Query(params): Query<TimeRangeQuery>,
) -> Json<DatabasesResponse> {
    let hours = parse_duration_hours(&params.from.unwrap_or_else(|| "1h".to_string()));
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    let from_ms = now_ms - (hours * 3600 * 1000);

    let query = format!(
        "SELECT \
            multiIf(\
                name LIKE 'postgresql.query%', 'postgresql', \
                name LIKE 'redis.query%', 'redis', \
                'other'\
            ) AS db_type, \
            count() AS total_queries, \
            countIf(error > 0) AS error_count, \
            avg(duration) / 1000.0 AS avg_latency_ms, \
            quantile(0.95)(duration) / 1000.0 AS p95_latency_ms, \
            uniqExact(service) AS service_count \
         FROM easy_monitor_traces \
         WHERE (name LIKE 'postgresql.query%' OR name LIKE 'redis.query%') \
           AND timestamp >= {} \
         GROUP BY db_type \
         ORDER BY total_queries DESC \
         FORMAT JSON",
        from_ms
    );
    let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(&query));

    let mut databases = Vec::new();

    if let Ok(res) = state.read_pool.client.get(&ch_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    let db_type = row.get("db_type").and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
                    if db_type == "other" { continue; }

                    let total_queries = parse_u64(row, "total_queries");
                    let error_count = parse_u64(row, "error_count");
                    let error_rate = if total_queries > 0 {
                        (error_count as f64 / total_queries as f64) * 100.0
                    } else { 0.0 };

                    let (display_name, icon) = match db_type.as_str() {
                        "postgresql" => ("PostgreSQL", "🐘"),
                        "redis" => ("Redis", "🔴"),
                        "mysql" => ("MySQL", "🐬"),
                        "mongodb" => ("MongoDB", "🍃"),
                        _ => (&*db_type, "💾"),
                    };

                    databases.push(DatabaseInfo {
                        db_type: db_type.clone(),
                        display_name: display_name.to_string(),
                        icon: icon.to_string(),
                        total_queries,
                        error_count,
                        error_rate,
                        avg_latency_ms: parse_f64(row, "avg_latency_ms"),
                        p95_latency_ms: parse_f64(row, "p95_latency_ms"),
                        service_count: parse_u64(row, "service_count"),
                    });
                }
            }
        }
    }

    Json(DatabasesResponse { databases })
}

// ─── GET /databases/:type/queries — Top queries by frequency/latency ───

#[derive(Serialize)]
pub struct DbQueryInfo {
    pub resource: String,
    pub frequency: u64,
    pub avg_latency_ms: f64,
    pub p95_latency_ms: f64,
    pub max_latency_ms: f64,
    pub error_count: u64,
    pub error_rate: f64,
    pub services: Vec<String>,
}

#[derive(Serialize)]
pub struct DbQueriesResponse {
    pub db_type: String,
    pub queries: Vec<DbQueryInfo>,
    pub total: u64,
}

#[derive(Deserialize)]
pub struct DbQueriesParams {
    pub from: Option<String>,
    pub sort: Option<String>,  // "frequency" | "latency" | "errors"
    pub limit: Option<usize>,
}

pub async fn get_db_queries(
    State(state): State<ApiState>,
    Path(db_type): Path<String>,
    Query(params): Query<DbQueriesParams>,
) -> Json<DbQueriesResponse> {
    let pattern = match db_like_pattern(&db_type) {
        Some(p) => p,
        None => return Json(DbQueriesResponse { db_type, queries: Vec::new(), total: 0 }),
    };

    let hours = parse_duration_hours(&params.from.unwrap_or_else(|| "1h".to_string()));
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    let from_ms = now_ms - (hours * 3600 * 1000);
    let limit = params.limit.unwrap_or(50).min(200);

    let order_by = match params.sort.as_deref() {
        Some("latency") => "avg_latency_ms DESC",
        Some("errors") => "error_count DESC",
        _ => "frequency DESC",
    };

    let query = format!(
        "SELECT \
            resource, \
            count() AS frequency, \
            avg(duration) / 1000.0 AS avg_latency_ms, \
            quantile(0.95)(duration) / 1000.0 AS p95_latency_ms, \
            max(duration) / 1000.0 AS max_latency_ms, \
            countIf(error > 0) AS error_count, \
            groupUniqArray(service) AS services \
         FROM easy_monitor_traces \
         WHERE name LIKE '{}' AND timestamp >= {} \
         GROUP BY resource \
         ORDER BY {} \
         LIMIT {} \
         FORMAT JSON",
        pattern, from_ms, order_by, limit
    );
    let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(&query));

    let mut queries = Vec::new();
    let mut total = 0u64;

    if let Ok(res) = state.read_pool.client.get(&ch_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(rows) = json_res.get("rows").and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok())
                .or_else(|| json_res.get("rows").and_then(|v| v.as_u64())) {
                total = rows;
            }
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    let frequency = parse_u64(row, "frequency");
                    let error_count = parse_u64(row, "error_count");
                    let error_rate = if frequency > 0 {
                        (error_count as f64 / frequency as f64) * 100.0
                    } else { 0.0 };

                    let services: Vec<String> = row.get("services")
                        .and_then(|v| v.as_array())
                        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                        .unwrap_or_default();

                    queries.push(DbQueryInfo {
                        resource: row.get("resource").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        frequency,
                        avg_latency_ms: parse_f64(row, "avg_latency_ms"),
                        p95_latency_ms: parse_f64(row, "p95_latency_ms"),
                        max_latency_ms: parse_f64(row, "max_latency_ms"),
                        error_count,
                        error_rate,
                        services,
                    });
                }
            }
        }
    }

    Json(DbQueriesResponse { db_type, queries, total })
}

// ─── GET /databases/:type/slow-queries — Slow query analysis ───

#[derive(Serialize)]
pub struct SlowQueryInfo {
    pub resource: String,
    pub service: String,
    pub duration_ms: f64,
    pub timestamp: String,
    pub timestamp_ms: i64,
    pub trace_id: String,
    pub error: bool,
}

#[derive(Serialize)]
pub struct SlowQueriesResponse {
    pub db_type: String,
    pub threshold_ms: f64,
    pub queries: Vec<SlowQueryInfo>,
}

pub async fn get_slow_queries(
    State(state): State<ApiState>,
    Path(db_type): Path<String>,
    Query(params): Query<TimeRangeQuery>,
) -> Json<SlowQueriesResponse> {
    let pattern = match db_like_pattern(&db_type) {
        Some(p) => p,
        None => return Json(SlowQueriesResponse { db_type, threshold_ms: 0.0, queries: Vec::new() }),
    };

    let hours = parse_duration_hours(&params.from.unwrap_or_else(|| "1h".to_string()));
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    let from_ms = now_ms - (hours * 3600 * 1000);

    // First get P95 to use as threshold
    let p95_query = format!(
        "SELECT quantile(0.95)(duration) / 1000.0 AS p95 \
         FROM easy_monitor_traces \
         WHERE name LIKE '{}' AND timestamp >= {} \
         FORMAT JSON",
        pattern, from_ms
    );
    let p95_url = format!("{}&query={}", CH_URL, urlencoding::encode(&p95_query));

    let mut threshold_ms = 100.0; // default fallback
    if let Ok(res) = state.read_pool.client.get(&p95_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()).and_then(|a| a.first()) {
                let p95 = parse_f64(data, "p95");
                if p95 > 0.0 { threshold_ms = p95; }
            }
        }
    }

    // Get queries exceeding P95
    let threshold_us = (threshold_ms * 1000.0) as i64;
    let query = format!(
        "SELECT resource, service, duration / 1000.0 AS duration_ms, timestamp, trace_id, error \
         FROM easy_monitor_traces \
         WHERE name LIKE '{}' AND timestamp >= {} AND duration > {} \
         ORDER BY duration DESC \
         LIMIT 50 \
         FORMAT JSON",
        pattern, from_ms, threshold_us
    );
    let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(&query));

    let mut queries = Vec::new();
    if let Ok(res) = state.read_pool.client.get(&ch_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    let ts = parse_i64(row, "timestamp");
                    let error_val = row.get("error")
                        .and_then(|v| v.as_str()).and_then(|s| s.parse::<i64>().ok())
                        .or_else(|| row.get("error").and_then(|v| v.as_i64()))
                        .unwrap_or(0);

                    queries.push(SlowQueryInfo {
                        resource: row.get("resource").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        service: row.get("service").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        duration_ms: parse_f64(row, "duration_ms"),
                        timestamp: chrono::DateTime::from_timestamp_millis(ts)
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_default(),
                        timestamp_ms: ts,
                        trace_id: row.get("trace_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        error: error_val > 0,
                    });
                }
            }
        }
    }

    Json(SlowQueriesResponse { db_type, threshold_ms, queries })
}

// ─── GET /databases/:type/services — Which services use this DB ───

#[derive(Serialize)]
pub struct DbServiceInfo {
    pub service: String,
    pub query_count: u64,
    pub error_count: u64,
    pub error_rate: f64,
    pub avg_latency_ms: f64,
    pub p95_latency_ms: f64,
}

#[derive(Serialize)]
pub struct DbServicesResponse {
    pub db_type: String,
    pub services: Vec<DbServiceInfo>,
}

pub async fn get_db_services(
    State(state): State<ApiState>,
    Path(db_type): Path<String>,
    Query(params): Query<TimeRangeQuery>,
) -> Json<DbServicesResponse> {
    let pattern = match db_like_pattern(&db_type) {
        Some(p) => p,
        None => return Json(DbServicesResponse { db_type, services: Vec::new() }),
    };

    let hours = parse_duration_hours(&params.from.unwrap_or_else(|| "1h".to_string()));
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    let from_ms = now_ms - (hours * 3600 * 1000);

    let query = format!(
        "SELECT \
            service, \
            count() AS query_count, \
            countIf(error > 0) AS error_count, \
            avg(duration) / 1000.0 AS avg_latency_ms, \
            quantile(0.95)(duration) / 1000.0 AS p95_latency_ms \
         FROM easy_monitor_traces \
         WHERE name LIKE '{}' AND timestamp >= {} \
         GROUP BY service \
         ORDER BY query_count DESC \
         FORMAT JSON",
        pattern, from_ms
    );
    let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(&query));

    let mut services = Vec::new();
    if let Ok(res) = state.read_pool.client.get(&ch_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    let query_count = parse_u64(row, "query_count");
                    let error_count = parse_u64(row, "error_count");
                    let error_rate = if query_count > 0 {
                        (error_count as f64 / query_count as f64) * 100.0
                    } else { 0.0 };

                    services.push(DbServiceInfo {
                        service: row.get("service").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        query_count,
                        error_count,
                        error_rate,
                        avg_latency_ms: parse_f64(row, "avg_latency_ms"),
                        p95_latency_ms: parse_f64(row, "p95_latency_ms"),
                    });
                }
            }
        }
    }

    Json(DbServicesResponse { db_type, services })
}

// ─── GET /databases/:type/timeseries — DB query rate + latency over time ───

#[derive(Serialize)]
pub struct DbTimePoint {
    pub timestamp: i64,
    pub query_count: u64,
    pub error_count: u64,
    pub avg_latency_ms: f64,
    pub p95_latency_ms: f64,
}

#[derive(Serialize)]
pub struct DbTimeseriesResponse {
    pub db_type: String,
    pub timeseries: Vec<DbTimePoint>,
}

pub async fn get_db_timeseries(
    State(state): State<ApiState>,
    Path(db_type): Path<String>,
    Query(params): Query<TimeRangeQuery>,
) -> Json<DbTimeseriesResponse> {
    let pattern = match db_like_pattern(&db_type) {
        Some(p) => p,
        None => return Json(DbTimeseriesResponse { db_type, timeseries: Vec::new() }),
    };

    let hours = parse_duration_hours(&params.from.unwrap_or_else(|| "1h".to_string()));
    let now_ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    let from_ms = now_ms - (hours * 3600 * 1000);

    // Auto-select bucket size based on time range
    let bucket_fn = if hours <= 1 { "toStartOfMinute" }
        else if hours <= 24 { "toStartOfFiveMinutes" }
        else { "toStartOfHour" };

    let query = format!(
        "SELECT \
            toUnixTimestamp({bucket}(toDateTime(intDiv(timestamp, 1000)))) * 1000 AS bucket, \
            count() AS query_count, \
            countIf(error > 0) AS error_count, \
            avg(duration) / 1000.0 AS avg_latency_ms, \
            quantile(0.95)(duration) / 1000.0 AS p95_latency_ms \
         FROM easy_monitor_traces \
         WHERE name LIKE '{pattern}' AND timestamp >= {from_ms} \
         GROUP BY bucket \
         ORDER BY bucket ASC \
         FORMAT JSON",
        bucket = bucket_fn,
        pattern = pattern,
        from_ms = from_ms
    );
    let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(&query));

    let mut timeseries = Vec::new();
    if let Ok(res) = state.read_pool.client.get(&ch_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    timeseries.push(DbTimePoint {
                        timestamp: parse_i64(row, "bucket"),
                        query_count: parse_u64(row, "query_count"),
                        error_count: parse_u64(row, "error_count"),
                        avg_latency_ms: parse_f64(row, "avg_latency_ms"),
                        p95_latency_ms: parse_f64(row, "p95_latency_ms"),
                    });
                }
            }
        }
    }

    Json(DbTimeseriesResponse { db_type, timeseries })
}
