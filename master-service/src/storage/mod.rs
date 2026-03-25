pub mod clickhouse;
pub mod users;

use tracing::info;
use reqwest::Client;

pub const CH_URL: &str = "http://localhost:8123/?user=default&password=password";

/// Initialize storage dependencies (schema, users table).
/// Note: The batch writer loop is now in write_path/ module (CQRS separation).
pub async fn initialize_storage() -> anyhow::Result<()> {
    info!("Bootstrapping Storage Engine dependencies...");
    
    let client = Client::new();

    // Initialize ClickHouse schema + materialized views
    if let Err(e) = clickhouse::initialize_clickhouse(&client).await {
        tracing::error!("Failed initializing OLAP schema: {}", e);
    }

    // Initialize users table
    if let Err(e) = users::initialize_users_table(&client).await {
        tracing::error!("Failed to initialize users table: {}", e);
    }
    
    Ok(())
}
