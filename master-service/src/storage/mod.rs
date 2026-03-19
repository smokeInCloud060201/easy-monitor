pub mod clickhouse;

use tracing::info;
use crate::bus::EventBusRx;

pub async fn start_storage_writer(rx: EventBusRx) -> anyhow::Result<()> {
    info!("Bootstrapping delegated Storage Engine dependencies natively...");
    tokio::spawn(async move {
        if let Err(e) = clickhouse::start_clickhouse_writer(rx).await {
            tracing::error!("ClickHouse storage loop crashed: {}", e);
        }
    });
    Ok(())
}
