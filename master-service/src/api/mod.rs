use std::sync::Arc;
use axum::{Router, routing::{get, post, delete}, middleware};
use dashmap::DashMap;
use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tracing::{info, error};

use crate::bus::{EventBusRx, Event};
use crate::read_path::ReadPool;

pub mod apm;
pub mod db_monitoring;
pub mod queries;
pub mod auth;

#[derive(Clone)]
pub struct ApiState {
    pub latest_metrics: Arc<DashMap<String, f64>>,
    pub jwt_secret: String,
    pub read_pool: ReadPool, // CQRS read-path: dedicated connection pool for queries
}

pub async fn start_api_gateway(mut rx: EventBusRx, jwt_secret: String) -> anyhow::Result<()> {
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
        jwt_secret,
        read_pool: ReadPool::new(), // CQRS: dedicated read connection pool
    };

    // Admin-only routes (behind both JWT + admin middleware)
    let admin_routes = Router::new()
        .route("/users", get(auth::list_users_handler).post(auth::create_user_handler))
        .route("/users/*username", delete(auth::delete_user_handler))
        .route_layer(middleware::from_fn(auth::require_admin));

    let api_routes = Router::new()
        .route("/apm/services", get(apm::get_services))
        .route("/apm/services/:name/resources", get(apm::get_resources))
        .route("/apm/services/:name/summary", get(apm::get_service_summary))
        .route("/apm/services/:name/errors", get(apm::get_service_errors))
        .route("/apm/service-map", get(apm::get_service_map))
        .route("/apm/services/:name/latency-distribution", get(apm::get_latency_distribution))
        .route("/apm/services/:name/dependencies", get(apm::get_service_dependencies))
        .route("/apm/services/:name/resources/:resource/summary", get(apm::get_resource_summary))
        .route("/traces/query", post(queries::query_traces))
        .route("/traces/search", post(queries::search_traces))
        .route("/logs/query", post(queries::query_logs))
        .route("/logs/histogram", post(queries::log_histogram))

        .route("/metrics/query", post(queries::query_metrics))
        .route("/system/metrics", get(queries::get_system_metrics))
        .route("/databases", get(db_monitoring::get_databases))
        .route("/databases/:db_type/queries", get(db_monitoring::get_db_queries))
        .route("/databases/:db_type/slow-queries", get(db_monitoring::get_slow_queries))
        .route("/databases/:db_type/services", get(db_monitoring::get_db_services))
        .route("/databases/:db_type/timeseries", get(db_monitoring::get_db_timeseries))
        .route("/auth/me", get(auth::me))
        .nest("/admin", admin_routes)
        .route_layer(middleware::from_fn_with_state(state.clone(), auth::require_jwt));

    let app = Router::new()
        .nest("/api/v1", api_routes)
        .route("/api/v1/auth/login", post(auth::login))
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
