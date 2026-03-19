pub mod clickhouse;

use tracing::info;
use crate::bus::EventBusRx;

pub async fn start_storage_writer(rx: EventBusRx) -> anyhow::Result<()> {
    info!("Bootstrapping delegated Storage Engine dependencies natively...");
    clickhouse::start_clickhouse_writer(rx).await
}
