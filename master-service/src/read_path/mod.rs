use reqwest::Client;
use tokio::time::Duration;
use tracing::info;

use crate::storage::CH_URL;

/// Read-optimized ClickHouse connection pool for dashboard queries.
/// Separate from write-path connections to prevent query contention with bulk inserts.
#[derive(Clone)]
pub struct ReadPool {
    pub client: Client,
    pub ch_url: String,
}

impl ReadPool {
    pub fn new() -> Self {
        let client = Client::builder()
            .pool_max_idle_per_host(10) // more connections for concurrent dashboard queries
            .timeout(Duration::from_secs(30)) // shorter timeout for reads
            .build()
            .unwrap_or_default();

        info!("Read-path: connection pool initialized (max_idle=10, timeout=30s)");

        Self {
            client,
            ch_url: CH_URL.to_string(),
        }
    }
}
