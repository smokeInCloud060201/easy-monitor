use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod api;
mod bus;
mod ingress;
mod processors;
mod storage;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .expect("setting default subscriber failed");

    info!("Starting Easy Monitor Master Service...");
    
    // Initialize Event Bus
    let (tx, _rx) = bus::init_event_bus();

    // Start Stream Processors
    processors::trace_metrics::start_trace_metrics_engine(tx.clone(), tx.subscribe()).await?;
    processors::alerts::start_alerts_evaluator(tx.clone(), tx.subscribe()).await?;
    processors::notifications::start_notifications_engine(tx.subscribe()).await?;
    
    // Mount ClickHouse Engine
    storage::start_storage_writer(tx.subscribe()).await?;

    // Start Axum API Gateway without dependencies on Tantivy
    api::start_api_gateway(tx.subscribe()).await?;

    // Start gRPC Ingress
    ingress::start_grpc_server(tx).await?;

    Ok(())
}
