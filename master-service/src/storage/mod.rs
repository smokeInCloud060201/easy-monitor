pub mod clickhouse;
pub mod users;

use tracing::info;
use crate::bus::EventBusRx;
use reqwest::Client;

pub const CH_URL: &str = "http://localhost:8123/?user=default&password=password";

pub async fn start_storage_writer(rx: EventBusRx) -> anyhow::Result<()> {
    info!("Bootstrapping delegated Storage Engine dependencies natively...");
    
    // Initialize users table
    let client = Client::new();
    if let Err(e) = users::initialize_users_table(&client).await {
        tracing::error!("Failed to initialize users table: {}", e);
    }
    
    tokio::spawn(async move {
        if let Err(e) = clickhouse::start_clickhouse_writer(rx).await {
            tracing::error!("ClickHouse storage loop crashed: {}", e);
        }
    });
    Ok(())
}
