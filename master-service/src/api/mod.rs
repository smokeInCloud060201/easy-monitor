use std::sync::Arc;
use axum::{Router, routing::{get, post}};
use dashmap::DashMap;
use tantivy::IndexReader;
use tower_http::cors::CorsLayer;
use tracing::{info, error};

use crate::bus::{EventBusRx, Event};

pub mod apm;
pub mod queries;

#[derive(Clone)]
pub struct ApiState {
    pub index_reader: Option<IndexReader>,
    pub latest_metrics: Arc<DashMap<String, f64>>,
}

pub async fn start_api_gateway(mut rx: EventBusRx, index_reader: Option<IndexReader>) -> anyhow::Result<()> {
    info!("Starting Axum API Gateway on 0.0.0.0:3000");

    let latest_metrics = Arc::new(DashMap::new());

    // Background task to keep latest metrics in memory for instant API queries
    let metrics_cache = latest_metrics.clone();
    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(Event::Metrics(payloads)) => {
                    for metric in payloads {
                        metrics_cache.insert(metric.name.clone(), metric.value);
                    }
                }
                Ok(_) => {} // Ignore logs/traces for the cache
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                Err(_) => {}
            }
        }
    });

    let state = ApiState {
        index_reader,
        latest_metrics,
    };

    let app = Router::new()
        .route("/api/v1/apm/services", get(apm::get_services))
        .route("/api/v1/apm/services/:name/resources", get(apm::get_resources))
        .route("/api/v1/traces/query", post(queries::query_traces))
        .route("/api/v1/metrics/query", post(queries::query_metrics))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    
    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            error!("Axum API Gateway failed: {}", e);
        }
    });

    Ok(())
}
