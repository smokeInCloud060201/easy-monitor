use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::ApiState;

#[derive(Deserialize)]
pub struct TracesQueryRequest {
    pub trace_id: String,
}

#[derive(Serialize)]
pub struct TracesQueryResponse {
    pub spans: Vec<serde_json::Value>, 
}

#[derive(Deserialize)]
pub struct LogsQueryRequest {
    pub keyword: Option<String>,
    pub service: Option<String>,
    pub pod_id: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Serialize)]
pub struct LogLineResponse {
    pub trace_id: String,
    pub service: String,
    pub message: String,
}

#[derive(Serialize)]
pub struct LogsQueryResponse {
    pub logs: Vec<LogLineResponse>,
}

pub async fn query_traces(State(_state): State<ApiState>, Json(_payload): Json<TracesQueryRequest>) -> Json<TracesQueryResponse> {
    // In a full implementation, execute a ClickHouse TermQuery for id == payload.trace_id
    Json(TracesQueryResponse { spans: vec![] })
}

pub async fn query_logs(State(_state): State<ApiState>, Json(payload): Json<LogsQueryRequest>) -> Json<LogsQueryResponse> {
    let client = reqwest::Client::new();
    let mut logs = Vec::new();
    
    let mut query = String::from("SELECT trace_id, service, message FROM easy_monitor_logs WHERE 1=1");
    
    if let Some(svc) = payload.service {
        if !svc.is_empty() && svc != "all" {
            query.push_str(&format!(" AND service = '{}'", svc));
        }
    }
    
    if let Some(pod) = payload.pod_id {
        if !pod.is_empty() && pod != "all" {
            query.push_str(&format!(" AND pod_id = '{}'", pod));
        }
    }
    
    if let Some(kw) = payload.keyword {
        if !kw.is_empty() {
             query.push_str(&format!(" AND message ILIKE '%{}%'", kw));
        }
    }
    
    let limit = payload.limit.unwrap_or(100);
    query.push_str(&format!(" ORDER BY timestamp DESC LIMIT {}", limit));
    
    let full_query = format!("{} FORMAT JSON", query);
    let ch_url = format!("http://localhost:8123/?user=default&password=password&query={}", urlencoding::encode(&full_query));
    
    if let Ok(res) = client.post(&ch_url).send().await {
        if let Ok(json_res) = res.json::<Value>().await {
            if let Some(data) = json_res.get("data").and_then(|d| d.as_array()) {
                for row in data {
                    logs.push(LogLineResponse {
                        trace_id: row.get("trace_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        service: row.get("service").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        message: row.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    });
                }
            }
        }
    }
    
    Json(LogsQueryResponse { logs })
}

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

#[derive(Deserialize)]
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
    let mut data = Vec::new();
    let now = chrono::Utc::now();
    for i in (0..60).rev() {
        let t = now - chrono::Duration::minutes(i);
        let time_val = t.timestamp() as f64;
        let cpu = 25.0 + (time_val / 200.0).sin() * 15.0; // Mock wave
        let ram = 60.0 + (time_val / 150.0).cos() * 5.0;  // Mock wave
        
        data.push(SystemMetricPoint {
            time: t.format("%H:%M").to_string(),
            cpu,
            ram,
        });
    }
    Json(data)
}
