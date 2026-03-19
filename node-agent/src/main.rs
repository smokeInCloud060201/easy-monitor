use anyhow::Result;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod apm;
mod collector;
mod dogstatsd;
mod forwarder;
mod logs;
mod wal;
use std::sync::Arc;
use crate::wal::WalBuffer;

#[tokio::main]
async fn main() -> Result<()> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)
        .expect("setting default subscriber failed");

    info!("Starting Easy Monitor Node Agent...");
    
    // Open the embedded Write-Ahead Log buffer
    std::fs::create_dir_all("/tmp/easy-monitor")?;
    let wal = Arc::new(WalBuffer::new("/tmp/easy-monitor/wal").expect("Failed to initialize WAL"));

    // Spawn APM Tracing Receiver
    let wal_apm = wal.clone();
    tokio::spawn(async move {
        if let Err(e) = apm::start_apm_receiver(wal_apm).await {
            tracing::error!("APM Receiver failed: {}", e);
        }
    });

    // Spawn DogStatsD Server
    let wal_dsd = wal.clone();
    tokio::spawn(async move {
        if let Err(e) = dogstatsd::start_dogstatsd_server(wal_dsd).await {
            tracing::error!("DogStatsD Server failed: {}", e);
        }
    });

    // Spawn Host Collector
    let wal_col = wal.clone();
    tokio::spawn(async move {
        if let Err(e) = collector::start_collector_worker(wal_col).await {
            tracing::error!("Collector Worker failed: {}", e);
        }
    });

    // Spawn Master Service Forwarder
    let wal_fwd = wal.clone();
    tokio::spawn(async move {
        if let Err(e) = forwarder::start_forwarder_worker(wal_fwd).await {
            tracing::error!("Forwarder Worker failed: {:?}", e);
        }
    });

    // Spawn Log Tailer
    let wal_logs = wal.clone();
    tokio::spawn(async move {
        if let Err(e) = logs::start_log_tailer(wal_logs, "/tmp/mock-logs").await {
            tracing::error!("Log Tailer Worker failed: {}", e);
        }
    });

    tokio::signal::ctrl_c().await?;
    info!("Shutting down Node Agent.");

    Ok(())
}
