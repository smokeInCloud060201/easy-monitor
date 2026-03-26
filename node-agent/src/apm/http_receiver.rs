use axum::{
    routing::post,
    Router,
    extract::State,
    http::StatusCode,
};
use axum::body::Bytes;
use std::sync::Arc;
use serde::Deserialize;
use std::collections::HashMap;
use tracing::{info, error};
use crate::wal::WalBuffer;
use shared_proto::traces::Span as InternalSpan;

#[derive(Debug, Deserialize)]
pub struct DatadogSpan {
    pub trace_id: u64,
    pub span_id: u64,
    pub parent_id: Option<u64>,
    pub name: String,
    pub resource: String,
    pub service: String,
    pub r#type: Option<String>,
    pub start: i64,
    pub duration: i64,
    pub error: Option<i32>,
    pub meta: Option<HashMap<String, String>>,
    pub metrics: Option<HashMap<String, f64>>,
}

pub async fn start_http_receiver(wal: Arc<WalBuffer>) -> anyhow::Result<()> {
    let app = Router::new()
        .route("/v0.4/traces", post(handle_traces))
        .route("/v0.3/traces", post(handle_traces))
        .with_state(wal);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8126").await?;
    info!("Datadog APM HTTP Receiver listening on {}", listener.local_addr()?);
    
    axum::serve(listener, app).await?;
    
    Ok(())
}

async fn handle_traces(
    State(wal): State<Arc<WalBuffer>>,
    body: Bytes,
) -> Result<StatusCode, StatusCode> {
    let traces: Vec<Vec<DatadogSpan>> = match rmp_serde::from_slice(&body) {
        Ok(t) => t,
        Err(e) => {
            error!("Failed to deserialize MessagePack traces: {}", e);
            return Err(StatusCode::BAD_REQUEST);
        }
    };

    for trace in traces {
        for span in trace {
            let internal_span = InternalSpan {
                trace_id: format!("{:016x}", span.trace_id),
                span_id: format!("{:016x}", span.span_id),
                parent_id: span.parent_id.map(|id| format!("{:016x}", id)).unwrap_or_default(),
                name: span.name,
                resource: span.resource,
                service: span.service,
                start_time: span.start / 1_000_000, // convert ns to ms
                duration: span.duration / 1_000_000, // convert ns to ms
                error: span.error.unwrap_or(0),
                meta: span.meta.unwrap_or_default(),
                metrics: span.metrics.unwrap_or_default(),
            };

            if let Err(e) = wal.write_trace(internal_span).await {
                error!("Failed to write Datadog span to WAL: {}", e);
            }
        }
    }

    Ok(StatusCode::OK)
}
