use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

use super::ApiState;

#[derive(Deserialize)]
pub struct TracesQueryRequest {
    pub trace_id: String,
}

#[derive(Serialize)]
pub struct TracesQueryResponse {
    pub spans: Vec<serde_json::Value>, 
}

pub async fn query_traces(State(_state): State<ApiState>, Json(_payload): Json<TracesQueryRequest>) -> Json<TracesQueryResponse> {
    // In a full implementation, execute a Tantivy Searcher TermQuery for id == payload.trace_id
    Json(TracesQueryResponse { spans: vec![] })
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
