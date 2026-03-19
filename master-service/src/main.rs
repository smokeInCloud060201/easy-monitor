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
    processors::alerts::start_alerts_evaluator(tx.subscribe()).await?;
    storage::start_storage_writer(tx.subscribe()).await?;

    // Open Tantivy Reader
    let index_path = std::path::Path::new("/tmp/easy-monitor/master-index");
    let index_reader = if let Ok(index) = tantivy::Index::open_in_dir(index_path) {
        index.reader().ok()
    } else {
        None
    };

    // Start Axum API Gateway
    api::start_api_gateway(tx.subscribe(), index_reader).await?;

    // Start gRPC Ingress
    ingress::start_grpc_server(tx).await?;

    Ok(())
}
