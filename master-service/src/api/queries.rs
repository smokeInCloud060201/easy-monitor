use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::ApiState;
use crate::storage::CH_URL;

// ─── Trace Query (Task 1.3: Real ClickHouse) ───

#[derive(Deserialize)]
pub struct TracesQueryRequest {
    pub trace_id: String,
}

#[derive(Serialize, Clone)]
pub struct SpanResponse {
    pub trace_id: String,
    pub span_id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub service: String,
    pub resource: String,
    pub error: i8,
    pub timestamp: String,
    pub duration_ms: f64,
    pub attributes: Value,
}

#[derive(Serialize)]
pub struct TracesQueryResponse {
    pub spans: Vec<SpanResponse>, 
}

pub async fn query_traces(State(state): State<ApiState>, Json(payload): Json<TracesQueryRequest>) -> Json<TracesQueryResponse> {
    let sanitized_id = payload.trace_id.replace('\'', "");
    let query = format!(
        "SELECT trace_id, span_id, parent_id, service, name, resource, error, duration, timestamp, attributes \
         FROM easy_monitor_traces WHERE trace_id = '{}' ORDER BY timestamp ASC FORMAT JSON",
        sanitized_id
    );
    let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(&query));

    if let Ok(res) = state.ch_client.get(&ch_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                if !data.is_empty() {
                    let spans: Vec<SpanResponse> = data.iter().filter_map(|row| {
                        let duration_raw = row.get("duration")
                            .and_then(|v| v.as_str())
                            .and_then(|s| s.parse::<f64>().ok())
                            .or_else(|| row.get("duration").and_then(|v| v.as_f64()))
                            .unwrap_or(0.0);
                        let parent = row.get("parent_id")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                            .filter(|s| !s.is_empty());
                        let ts_raw = row.get("timestamp")
                            .and_then(|v| v.as_str())
                            .and_then(|s| s.parse::<i64>().ok())
                            .or_else(|| row.get("timestamp").and_then(|v| v.as_i64()))
                            .unwrap_or(0);
                        
                        Some(SpanResponse {
                            trace_id: row.get("trace_id")?.as_str()?.to_string(),
                            span_id: row.get("span_id")?.as_str()?.to_string(),
                            parent_id: parent,
                            name: row.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            service: row.get("service").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            resource: row.get("resource").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            error: row.get("error")
                                .and_then(|v| v.as_str())
                                .and_then(|s| s.parse::<i8>().ok())
                                .or_else(|| row.get("error").and_then(|v| v.as_i64()).map(|n| n as i8))
                                .unwrap_or(0),
                            timestamp: chrono::DateTime::from_timestamp_millis(ts_raw)
                                .map(|dt| dt.to_rfc3339())
                                .unwrap_or_default(),
                            duration_ms: duration_raw / 1000.0,
                            attributes: {
                                let attrs_str = row.get("attributes").and_then(|v| v.as_str()).unwrap_or("{}");
                                serde_json::from_str(attrs_str).unwrap_or(Value::Object(Default::default()))
                            },
                        })
                    }).collect();

                    if !spans.is_empty() {
                        return Json(TracesQueryResponse { spans });
                    }
                }
            }
        }
    }

    Json(TracesQueryResponse { spans: Vec::new() })
}

// ─── Trace Search (Task 1.4) ───

#[derive(Deserialize)]
pub struct TraceSearchRequest {
    pub service: Option<String>,
    pub resource: Option<String>,
    pub status: Option<String>,       // "ok" | "error"
    pub min_duration_ms: Option<f64>,
    pub max_duration_ms: Option<f64>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Serialize)]
pub struct TraceSummary {
    pub trace_id: String,
    pub root_service: String,
    pub root_name: String,
    pub duration_ms: f64,
    pub span_count: u64,
    pub error: bool,
    pub timestamp: String,
}

#[derive(Serialize)]
pub struct TraceSearchResponse {
    pub traces: Vec<TraceSummary>,
    pub total: u64,
}

pub async fn search_traces(State(state): State<ApiState>, Json(payload): Json<TraceSearchRequest>) -> Json<TraceSearchResponse> {
    let mut where_clauses = Vec::new();
    
    if let Some(ref svc) = payload.service {
        if !svc.is_empty() && svc != "all" {
            where_clauses.push(format!("service = '{}'", svc.replace('\'', "")));
        }
    }
    if let Some(ref res) = payload.resource {
        if !res.is_empty() {
            where_clauses.push(format!("resource = '{}'", res.replace('\'', "")));
        }
    }
    if let Some(ref status) = payload.status {
        match status.as_str() {
            "error" => where_clauses.push("error > 0".to_string()),
            "ok" => where_clauses.push("error = 0".to_string()),
            _ => {}
        }
    }
    if let Some(min_dur) = payload.min_duration_ms {
        where_clauses.push(format!("duration >= {}", (min_dur * 1000.0) as i64));
    }
    if let Some(max_dur) = payload.max_duration_ms {
        where_clauses.push(format!("duration <= {}", (max_dur * 1000.0) as i64));
    }

    let where_str = if where_clauses.is_empty() {
        "1=1".to_string()
    } else {
        where_clauses.join(" AND ")
    };

    let limit = payload.limit.unwrap_or(50).min(200);
    let offset = payload.offset.unwrap_or(0);

    let query = format!(
        "SELECT trace_id, \
         argMin(service, tuple(parent_id != '', timestamp)) as root_service, \
         argMin(name, tuple(parent_id != '', timestamp)) as root_name, \
         max(duration) / 1000.0 as duration_ms, \
         count() as span_count, \
         max(error) as has_error, \
         min(timestamp) as ts \
         FROM easy_monitor_traces \
         WHERE {} \
         GROUP BY trace_id \
         ORDER BY ts DESC \
         LIMIT {} OFFSET {} \
         FORMAT JSON",
        where_str, limit, offset
    );

    let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(&query));

    let mut traces = Vec::new();
    let mut total = 0u64;

    if let Ok(res) = state.ch_client.get(&ch_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(rows_val) = json_res.get("rows").and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok())
                .or_else(|| json_res.get("rows").and_then(|v| v.as_u64())) {
                total = rows_val;
            }
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    let ts_raw = row.get("ts")
                        .and_then(|v| v.as_str())
                        .and_then(|s| s.parse::<i64>().ok())
                        .or_else(|| row.get("ts").and_then(|v| v.as_i64()))
                        .unwrap_or(0);
                    let has_error = row.get("has_error")
                        .and_then(|v| v.as_str())
                        .and_then(|s| s.parse::<i64>().ok())
                        .or_else(|| row.get("has_error").and_then(|v| v.as_i64()))
                        .unwrap_or(0);
                    let dur = row.get("duration_ms")
                        .and_then(|v| v.as_str())
                        .and_then(|s| s.parse::<f64>().ok())
                        .or_else(|| row.get("duration_ms").and_then(|v| v.as_f64()))
                        .unwrap_or(0.0);
                    let span_count = row.get("span_count")
                        .and_then(|v| v.as_str())
                        .and_then(|s| s.parse::<u64>().ok())
                        .or_else(|| row.get("span_count").and_then(|v| v.as_u64()))
                        .unwrap_or(0);

                    traces.push(TraceSummary {
                        trace_id: row.get("trace_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        root_service: row.get("root_service").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        root_name: row.get("root_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        duration_ms: dur,
                        span_count,
                        error: has_error > 0,
                        timestamp: chrono::DateTime::from_timestamp_millis(ts_raw)
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_default(),
                    });
                }
            }
        }
    }

    Json(TraceSearchResponse { traces, total })
}

// ─── Logs Query (GrayLog-style) ───

#[derive(Deserialize)]
pub struct LogsQueryRequest {
    pub keyword: Option<String>,
    pub service: Option<String>,
    pub level: Option<String>,
    pub pod_id: Option<String>,
    pub trace_id: Option<String>,
    pub host: Option<String>,
    pub source: Option<String>,
    pub namespace: Option<String>,
    pub node_name: Option<String>,
    pub from_ts: Option<i64>,
    pub to_ts: Option<i64>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Serialize, Clone)]
pub struct LogLineResponse {
    pub trace_id: String,
    pub span_id: String,
    pub service: String,
    pub level: String,
    pub message: String,
    pub pod_id: String,
    pub namespace: String,
    pub node_name: String,
    pub host: String,
    pub source: String,
    pub attributes: Value,
    pub timestamp: String,
    pub timestamp_ms: i64,
}

#[derive(Serialize)]
pub struct LogsQueryResponse {
    pub logs: Vec<LogLineResponse>,
    pub total: u64,
}

fn build_logs_where_clauses(payload: &LogsQueryRequest) -> Vec<String> {
    let mut clauses = Vec::new();
    if let Some(ref svc) = payload.service {
        if !svc.is_empty() && svc != "all" {
            clauses.push(format!("service = '{}'", svc.replace('\'', "")));
        }
    }
    if let Some(ref lvl) = payload.level {
        if !lvl.is_empty() && lvl != "all" {
            clauses.push(format!("level = '{}'", lvl.replace('\'', "")));
        }
    }
    if let Some(ref pod) = payload.pod_id {
        if !pod.is_empty() && pod != "all" {
            clauses.push(format!("pod_id = '{}'", pod.replace('\'', "")));
        }
    }
    if let Some(ref tid) = payload.trace_id {
        if !tid.is_empty() {
            clauses.push(format!("trace_id = '{}'", tid.replace('\'', "")));
        }
    }
    if let Some(kw) = &payload.keyword {
        if !kw.is_empty() {
            clauses.push(format!("message ILIKE '%{}%'", kw.replace('\'', "")));
        }
    }
    if let Some(ref host) = payload.host {
        if !host.is_empty() {
            clauses.push(format!("host = '{}'", host.replace('\'', "")));
        }
    }
    if let Some(ref source) = payload.source {
        if !source.is_empty() {
            clauses.push(format!("source = '{}'", source.replace('\'', "")));
        }
    }
    if let Some(ref ns) = payload.namespace {
        if !ns.is_empty() {
            clauses.push(format!("namespace = '{}'", ns.replace('\'', "")));
        }
    }
    if let Some(ref node) = payload.node_name {
        if !node.is_empty() {
            clauses.push(format!("node_name = '{}'", node.replace('\'', "")));
        }
    }
    if let Some(from) = payload.from_ts {
        clauses.push(format!("timestamp >= {}", from));
    }
    if let Some(to) = payload.to_ts {
        clauses.push(format!("timestamp <= {}", to));
    }
    clauses
}

pub async fn query_logs(State(state): State<ApiState>, Json(payload): Json<LogsQueryRequest>) -> Json<LogsQueryResponse> {
    let mut logs = Vec::new();
    let mut total = 0u64;

    let where_clauses = build_logs_where_clauses(&payload);
    let where_str = if where_clauses.is_empty() { "1=1".to_string() } else { where_clauses.join(" AND ") };

    let limit = payload.limit.unwrap_or(100).min(500);
    let offset = payload.offset.unwrap_or(0);

    // Main query
    let query = format!(
        "SELECT trace_id, span_id, service, level, message, pod_id, namespace, node_name, host, source, attributes, timestamp \
         FROM easy_monitor_logs WHERE {} ORDER BY timestamp DESC LIMIT {} OFFSET {} FORMAT JSON",
        where_str, limit, offset
    );
    let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(&query));

    if let Ok(res) = state.ch_client.get(&ch_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    let ts_raw = row.get("timestamp")
                        .and_then(|v| v.as_str()).and_then(|s| s.parse::<i64>().ok())
                        .or_else(|| row.get("timestamp").and_then(|v| v.as_i64()))
                        .unwrap_or(0);
                    let attrs_str = row.get("attributes").and_then(|v| v.as_str()).unwrap_or("{}");
                    let attrs: Value = serde_json::from_str(attrs_str).unwrap_or(Value::Object(Default::default()));

                    logs.push(LogLineResponse {
                        trace_id: row.get("trace_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        span_id: row.get("span_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        service: row.get("service").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        level: row.get("level").and_then(|v| v.as_str()).unwrap_or("INFO").to_string(),
                        message: row.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        pod_id: row.get("pod_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        namespace: row.get("namespace").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        node_name: row.get("node_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        host: row.get("host").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        source: row.get("source").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        attributes: attrs,
                        timestamp: chrono::DateTime::from_timestamp_millis(ts_raw)
                            .map(|dt| dt.to_rfc3339()).unwrap_or_default(),
                        timestamp_ms: ts_raw,
                    });
                }
            }
        }
    }

    // Count query for pagination
    let count_query = format!(
        "SELECT count() as cnt FROM easy_monitor_logs WHERE {} FORMAT JSON", where_str
    );
    let count_url = format!("{}&query={}", CH_URL, urlencoding::encode(&count_query));
    if let Ok(res) = state.ch_client.get(&count_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()).and_then(|a| a.first()) {
                total = data.get("cnt")
                    .and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok())
                    .or_else(|| data.get("cnt").and_then(|v| v.as_u64()))
                    .unwrap_or(0);
            }
        }
    }

    Json(LogsQueryResponse { logs, total })
}

// ─── Logs Histogram ───

#[derive(Deserialize)]
pub struct LogHistogramRequest {
    pub service: Option<String>,
    pub level: Option<String>,
    pub keyword: Option<String>,
    pub host: Option<String>,
    pub source: Option<String>,
    pub namespace: Option<String>,
    pub from_ts: Option<i64>,
    pub to_ts: Option<i64>,
    pub interval: Option<String>,
}

#[derive(Serialize)]
pub struct HistogramBucket {
    pub timestamp: i64,
    pub count: u64,
    pub error_count: u64,
    pub warn_count: u64,
}

#[derive(Serialize)]
pub struct LogHistogramResponse {
    pub buckets: Vec<HistogramBucket>,
}

pub async fn log_histogram(State(state): State<ApiState>, Json(payload): Json<LogHistogramRequest>) -> Json<LogHistogramResponse> {
    let mut buckets = Vec::new();

    let bucket_fn = match payload.interval.as_deref() {
        Some("hour") => "toStartOfHour",
        Some("day") => "toStartOfDay",
        _ => "toStartOfMinute",
    };

    let mut where_clauses = Vec::new();
    if let Some(ref svc) = payload.service {
        if !svc.is_empty() && svc != "all" {
            where_clauses.push(format!("service = '{}'", svc.replace('\'', "")));
        }
    }
    if let Some(ref lvl) = payload.level {
        if !lvl.is_empty() && lvl != "all" {
            where_clauses.push(format!("level = '{}'", lvl.replace('\'', "")));
        }
    }
    if let Some(ref kw) = payload.keyword {
        if !kw.is_empty() {
            where_clauses.push(format!("message ILIKE '%{}%'", kw.replace('\'', "")));
        }
    }
    if let Some(ref host) = payload.host {
        if !host.is_empty() {
            where_clauses.push(format!("host = '{}'", host.replace('\'', "")));
        }
    }
    if let Some(ref source) = payload.source {
        if !source.is_empty() {
            where_clauses.push(format!("source = '{}'", source.replace('\'', "")));
        }
    }
    if let Some(ref ns) = payload.namespace {
        if !ns.is_empty() {
            where_clauses.push(format!("namespace = '{}'", ns.replace('\'', "")));
        }
    }
    if let Some(from) = payload.from_ts {
        where_clauses.push(format!("timestamp >= {}", from));
    }
    if let Some(to) = payload.to_ts {
        where_clauses.push(format!("timestamp <= {}", to));
    }

    let where_str = if where_clauses.is_empty() { "1=1".to_string() } else { where_clauses.join(" AND ") };

    let query = format!(
        "SELECT toUnixTimestamp({}(toDateTime(timestamp / 1000))) * 1000 as bucket, \
         count() as count, \
         countIf(level = 'ERROR') as error_count, \
         countIf(level = 'WARN') as warn_count \
         FROM easy_monitor_logs WHERE {} \
         GROUP BY bucket ORDER BY bucket ASC FORMAT JSON",
        bucket_fn, where_str
    );
    let ch_url = format!("{}&query={}", CH_URL, urlencoding::encode(&query));

    if let Ok(res) = state.ch_client.get(&ch_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    let ts = row.get("bucket")
                        .and_then(|v| v.as_str()).and_then(|s| s.parse::<i64>().ok())
                        .or_else(|| row.get("bucket").and_then(|v| v.as_i64()))
                        .unwrap_or(0);
                    let count = row.get("count")
                        .and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok())
                        .or_else(|| row.get("count").and_then(|v| v.as_u64()))
                        .unwrap_or(0);
                    let err = row.get("error_count")
                        .and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok())
                        .or_else(|| row.get("error_count").and_then(|v| v.as_u64()))
                        .unwrap_or(0);
                    let warn = row.get("warn_count")
                        .and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok())
                        .or_else(|| row.get("warn_count").and_then(|v| v.as_u64()))
                        .unwrap_or(0);
                    buckets.push(HistogramBucket { timestamp: ts, count, error_count: err, warn_count: warn });
                }
            }
        }
    }


    Json(LogHistogramResponse { buckets })
}

// ─── Logs Field Statistics ───

#[derive(Deserialize)]
pub struct LogFieldsRequest {
    pub from_ts: Option<i64>,
    pub to_ts: Option<i64>,
    pub service: Option<String>,
}

#[derive(Serialize)]
pub struct FieldValue {
    pub value: String,
    pub count: u64,
    pub percentage: f64,
}

#[derive(Serialize)]
pub struct FieldStat {
    pub field: String,
    pub top_values: Vec<FieldValue>,
}

#[derive(Serialize)]
pub struct LogFieldsResponse {
    pub fields: Vec<FieldStat>,
    pub total_logs: u64,
}

pub async fn log_fields(State(state): State<ApiState>, Json(payload): Json<LogFieldsRequest>) -> Json<LogFieldsResponse> {
    let mut fields = Vec::new();
    let mut total_logs = 0u64;

    let mut where_clauses = Vec::new();
    if let Some(ref svc) = payload.service {
        if !svc.is_empty() && svc != "all" {
            where_clauses.push(format!("service = '{}'", svc.replace('\'', "")));
        }
    }
    if let Some(from) = payload.from_ts {
        where_clauses.push(format!("timestamp >= {}", from));
    }
    if let Some(to) = payload.to_ts {
        where_clauses.push(format!("timestamp <= {}", to));
    }
    let where_str = if where_clauses.is_empty() { "1=1".to_string() } else { where_clauses.join(" AND ") };

    // Get total count
    let count_q = format!("SELECT count() as cnt FROM easy_monitor_logs WHERE {} FORMAT JSON", where_str);
    let count_url = format!("{}&query={}", CH_URL, urlencoding::encode(&count_q));
    if let Ok(res) = state.ch_client.get(&count_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()).and_then(|a| a.first()) {
                total_logs = data.get("cnt")
                    .and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok())
                    .or_else(|| data.get("cnt").and_then(|v| v.as_u64()))
                    .unwrap_or(0);
            }
        }
    }

    // Query top values for each field
    let field_names = ["service", "level", "pod_id", "namespace", "node_name", "host", "source"];
    for field_name in &field_names {
        let q = format!(
            "SELECT {} as val, count() as cnt FROM easy_monitor_logs WHERE {} GROUP BY val ORDER BY cnt DESC LIMIT 10 FORMAT JSON",
            field_name, where_str
        );
        let url = format!("{}&query={}", CH_URL, urlencoding::encode(&q));

        let mut top_values = Vec::new();
        if let Ok(res) = state.ch_client.get(&url).send().await {
            if let Ok(json_res) = res.json::<Value>().await {
                if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                    for row in data {
                        let val = row.get("val").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let cnt = row.get("cnt")
                            .and_then(|v| v.as_str()).and_then(|s| s.parse::<u64>().ok())
                            .or_else(|| row.get("cnt").and_then(|v| v.as_u64()))
                            .unwrap_or(0);
                        if !val.is_empty() {
                            let pct = if total_logs > 0 { (cnt as f64 / total_logs as f64) * 100.0 } else { 0.0 };
                            top_values.push(FieldValue { value: val, count: cnt, percentage: pct });
                        }
                    }
                }
            }
        }

        if !top_values.is_empty() {
            fields.push(FieldStat { field: field_name.to_string(), top_values });
        }
    }


    Json(LogFieldsResponse { fields, total_logs })
}

// ─── RED Metrics Query ───

#[derive(Deserialize)]
pub struct MetricsQueryRequest {
    pub service: String,
    pub resource: String,
}

#[derive(Serialize)]
pub struct MetricsQueryResponse {
    pub rate: f64,
    pub error_count: f64,
    pub duration_sum: f64,
}

pub async fn query_metrics(State(state): State<ApiState>, Json(payload): Json<MetricsQueryRequest>) -> Json<MetricsQueryResponse> {
    let base = format!("apm.{}:{}", payload.service, payload.resource);
    
    let rate = state.latest_metrics.get(&format!("{}:rate", base)).map(|r| *r.value()).unwrap_or(0.0);
    let error_count = state.latest_metrics.get(&format!("{}:error", base)).map(|r| *r.value()).unwrap_or(0.0);
    let duration_sum = state.latest_metrics.get(&format!("{}:duration_sum", base)).map(|r| *r.value()).unwrap_or(0.0);

    Json(MetricsQueryResponse {
        rate,
        error_count,
        duration_sum,
    })
}

// ─── System Metrics ───

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct SystemMetricsRequest {
    pub from: Option<String>,
    pub to: Option<String>,
}

#[derive(Serialize)]
pub struct SystemMetricPoint {
    pub time: String,
    pub cpu: f64,
    pub ram: f64,
}

pub async fn get_system_metrics(axum::extract::Query(_query): axum::extract::Query<SystemMetricsRequest>) -> Json<Vec<SystemMetricPoint>> {
    Json(Vec::new())
}
