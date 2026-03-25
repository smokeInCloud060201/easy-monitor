use crate::repository::InventoryRepository;
use crate::domain::InventoryStatusResponse;
use rand::Rng;
use std::time::Duration;

pub struct InventoryService {
    repo: InventoryRepository,
    redis: redis::Client,
}

impl InventoryService {
    pub fn new(repo: InventoryRepository, redis_url: &str) -> Self {
        let redis = redis::Client::open(redis_url)
            .expect("Failed to create Redis client");
        Self { repo, redis }
    }

    async fn simulate_sleep(min_ms: u64, max_ms: u64) {
        let ms = { rand::thread_rng().gen_range(min_ms..=max_ms) };
        tokio::time::sleep(Duration::from_millis(ms)).await;
    }

    pub async fn get_status(&self, product_id: &str) -> Option<InventoryStatusResponse> {
        Self::simulate_sleep(1, 5).await;

        if let Ok(mut con) = self.redis.get_multiplexed_async_connection().await {
            let cache_key = format!("inventory:{}", product_id);
            let cached: redis::RedisResult<String> = redis::AsyncCommands::get(&mut con, &cache_key).await;
            if let Ok(val) = cached {
                if let Ok(inv) = serde_json::from_str::<crate::domain::Inventory>(&val) {
                    tracing::info!("Cache hit for product inventory: {}", product_id);
                    return Some(InventoryStatusResponse {
                        product_id: inv.product_id,
                        stock_qty: inv.stock_qty,
                        warehouse_location: inv.warehouse_location,
                    });
                }
            }
        }

        tracing::info!("Cache miss for product: {}, querying DB", product_id);
        Self::simulate_sleep(10, 35).await;

        if let Ok(Some(inv)) = self.repo.find_product_inventory(product_id).await {
            if let Ok(mut con) = self.redis.get_multiplexed_async_connection().await {
                let cache_key = format!("inventory:{}", product_id);
                if let Ok(json_str) = serde_json::to_string(&inv) {
                    let _: redis::RedisResult<()> = redis::AsyncCommands::set_ex(&mut con, cache_key, json_str, 600).await;
                }
            }
            return Some(InventoryStatusResponse {
                product_id: inv.product_id,
                stock_qty: inv.stock_qty,
                warehouse_location: inv.warehouse_location,
            });
        }

        None
    }
}
