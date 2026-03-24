pub mod domain;
pub mod repository;
pub mod service;
pub mod controller;

use actix_web::{web, App, HttpServer};
use tracing_actix_web::TracingLogger;
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;

fn init_telemetry() {
    easymonitor_agent::init_telemetry("inventory-service");
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    init_telemetry();
    println!("[INFO] Inventory Service (Rust DDD) running on :8086");

    // Initialize Infra
    let database_url = "postgres://easymonitor:password@localhost:5432/easymonitor";
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await
        .expect("Failed to connect to Postgres");

    // Init Architecture
    let repo = repository::InventoryRepository::new(pool);
    repo.init_schema().await.expect("Failed to initialize database schema");
    
    let inventory_service = Arc::new(service::InventoryService::new(repo, "redis://localhost:6379/"));

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(inventory_service.clone()))
            .wrap(easymonitor_agent::actix_middleware::EasyMonitorActix)
            .wrap(TracingLogger::default())
            .route("/api/notify", web::post().to(controller::handle_notify))
            .route("/api/inventorys/{order_id}", web::get().to(controller::handle_get_inventory))
            .route("/api/health", web::get().to(controller::handle_health))
    })
    .bind("0.0.0.0:8086")?
    .run()
    .await
}
