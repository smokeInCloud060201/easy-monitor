pub mod batch_writer;

use tracing::info;

use crate::bus::WriteReceivers;
use crate::storage::CH_URL;

/// Start all write-path batch writers.
/// Each data type gets its own independent writer task with size-OR-time flush.
pub async fn start_writers(receivers: WriteReceivers) -> anyhow::Result<()> {
    info!("Starting CQRS write-path batch writers...");

    let write_url = CH_URL.to_string();

    // Logs writer
    let logs_url = write_url.clone();
    tokio::spawn(async move {
        batch_writer::start_logs_writer(receivers.logs_rx, &logs_url).await;
    });

    // Traces writer
    let traces_url = write_url.clone();
    tokio::spawn(async move {
        batch_writer::start_traces_writer(receivers.traces_rx, &traces_url).await;
    });

    // Metrics drainer (raw metrics not persisted yet, just drain to avoid full channel warnings)
    let mut metrics_rx = receivers.metrics_rx;
    tokio::spawn(async move {
        while let Some(_) = metrics_rx.recv().await {}
    });

    info!("Write-path batch writers started (logs, traces).");
    Ok(())
}
