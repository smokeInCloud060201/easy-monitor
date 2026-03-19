use anyhow::Result;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod bus;
mod ingress;

#[tokio::main]
async fn main() -> Result<()> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .expect("setting default subscriber failed");

    info!("Starting Easy Monitor Master Service...");
    
    // Initialize Event Bus
    let (tx, _rx) = bus::init_event_bus();

    // Start gRPC Ingress
    ingress::start_grpc_server(tx).await?;

    Ok(())
}
