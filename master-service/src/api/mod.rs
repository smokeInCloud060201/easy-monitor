use std::sync::Arc;
use axum::{Router, routing::{get, post}, middleware};
use dashmap::DashMap;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tracing::{info, error};

use crate::bus::{EventBusRx, Event};

pub mod apm;
pub mod queries;
pub mod auth;

#[derive(Clone)]
pub struct ApiState {
    pub latest_metrics: Arc<DashMap<String, f64>>,
}

pub async fn start_api_gateway(mut rx: EventBusRx) -> anyhow::Result<()> {
    info!("Starting Axum API Gateway on 0.0.0.0:3000");

    let latest_metrics = Arc::new(DashMap::new());
    let metrics_cache = latest_metrics.clone();
    
    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(Event::Metrics(payloads)) => {
                    for metric in payloads {
                        metrics_cache.insert(metric.name.clone(), metric.value);
                    }
                }
                Ok(_) => {} 
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                Err(_) => {} 
            }
        }
    });

    let state = ApiState {
        latest_metrics,
    };

    let api_routes = Router::new()
        .route("/apm/services", get(apm::get_services))
        .route("/apm/services/:name/resources", get(apm::get_resources))
        .route("/traces/query", post(queries::query_traces))
        .route("/logs/query", post(queries::query_logs))
        .route("/metrics/query", post(queries::query_metrics))
        .route("/system/metrics", get(queries::get_system_metrics))
        .route_layer(middleware::from_fn(auth::require_jwt));

    let app = Router::new()
        .nest("/api/v1", api_routes)
        .route("/api/v1/login", get(auth::login_stub))
        .layer(CorsLayer::permissive())
        .with_state(state)
        .fallback_service(
            ServeDir::new("dist")
                .fallback(ServeFile::new("dist/index.html"))
        );

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    
    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            error!("Axum API Gateway failed: {}", e);
        }
    });

    Ok(())
}
