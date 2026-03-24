pub mod domain;
pub mod repository;
pub mod service;
pub mod controller;

use actix_web::{web, App, HttpServer};
use tracing_actix_web::TracingLogger;
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;

fn init_telemetry() {
    easymonitor_agent::init_telemetry("notification-service");
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    init_telemetry();
    println!("[INFO] Notification Service (Rust DDD) running on :8083");

    // Initialize Infra
    let database_url = "postgres://easymonitor:password@localhost:5432/easymonitor";
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await
        .expect("Failed to connect to Postgres");

    // Init Architecture
    let repo = repository::NotificationRepository::new(pool);
    repo.init_schema().await.expect("Failed to initialize database schema");
    
    let notification_service = Arc::new(service::NotificationService::new(repo, "redis://localhost:6379/"));

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(notification_service.clone()))
            .wrap(TracingLogger::default())
            .route("/api/notify", web::post().to(controller::handle_notify))
            .route("/api/notifications/{order_id}", web::get().to(controller::handle_get_notification))
            .route("/api/health", web::get().to(controller::handle_health))
    })
    .bind("0.0.0.0:8083")?
    .run()
    .await
}
