use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod api;
mod bus;
mod ingress;
mod processors;
mod read_path;
mod storage;
mod utils;
mod write_path;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .expect("setting default subscriber failed");

    info!("Starting Easy Monitor Master Service...");

    // Read JWT secret from environment
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| {
            info!("JWT_SECRET not set, using default dev secret. Set JWT_SECRET in production!");
            "dev-secret-key-change-in-production-minimum-32-chars".to_string()
        });
    if jwt_secret.len() < 32 {
        panic!("JWT_SECRET must be at least 32 characters long");
    }
    
    // ─── CQRS Channel System ───
    // Per-type mpsc channels for write-path + broadcast for processor fan-out
    let (write_channels, write_receivers, event_tx, _event_rx) = bus::init_channels();

    // ─── Storage Schema Initialization ───
    // Creates ClickHouse tables + materialized views (no writer loop — handled by write_path)
    storage::initialize_storage().await?;

    // ─── Write-Path Batch Writers ───
    // Consumes mpsc receivers, flushes to ClickHouse at 1000 rows OR 2 seconds
    write_path::start_writers(write_receivers).await?;

    // ─── Stream Processors (use broadcast for fan-out) ───
    processors::trace_metrics::start_trace_metrics_engine(event_tx.clone(), event_tx.subscribe()).await?;
    processors::alerts::start_alerts_evaluator(event_tx.clone(), event_tx.subscribe()).await?;
    processors::notifications::start_notifications_engine(event_tx.subscribe()).await?;

    // ─── Read-Path API Gateway ───
    // Uses dedicated ReadPool for ClickHouse queries (separate from write-path connections)
    api::start_api_gateway(event_tx.subscribe(), jwt_secret).await?;

    // ─── gRPC Ingress ───
    // Dual-sends to: mpsc channels (write-path) + broadcast (processors)
    ingress::start_grpc_server(write_channels, event_tx).await?;

    Ok(())
}
