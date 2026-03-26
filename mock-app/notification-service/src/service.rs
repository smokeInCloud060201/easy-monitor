use crate::repository::NotificationRepository;
use crate::domain::{NotificationLog, NotifyRequest, NotifyResponse, NotificationStatusResponse};
use rand::Rng;
use std::time::Duration;
use chrono::Utc;
use uuid::Uuid;

pub struct NotificationService {
    repo: NotificationRepository,
    redis: redis::Client,
}

impl NotificationService {
    pub fn new(repo: NotificationRepository, redis_url: &str) -> Self {
        let redis = redis::Client::open(redis_url)
            .expect("Failed to create Redis client");
        Self { repo, redis }
    }

    async fn simulate_sleep(min_ms: u64, max_ms: u64) {
        let ms = { rand::thread_rng().gen_range(min_ms..=max_ms) };
        tokio::time::sleep(Duration::from_millis(ms)).await;
    }

    pub async fn process_notification(&self, req: NotifyRequest) -> Result<NotifyResponse, String> {
        let order_id = req.order_id.unwrap_or_else(|| "unknown".to_string());
        let email = req.email.unwrap_or_else(|| "customer@example.com".to_string());
        let notification_id = format!("notif_{}", &Uuid::new_v4().to_string()[..8]);

        Self::simulate_sleep(10, 40).await;
        
        let fail = { rand::thread_rng().gen::<f64>() < 0.03 };
        if fail {
            return Err("Template render failed".to_string());
        }

        Self::simulate_sleep(50, 200).await;
        let timeout = { rand::thread_rng().gen::<f64>() < 0.05 };
        if timeout {
            return Err("SMTP timeout".to_string());
        }

        let log = NotificationLog {
            id: notification_id.clone(),
            order_id: order_id.clone(),
            recipient: email.clone(),
            channel: "email".to_string(),
            status: "sent".to_string(),
            sent_at: Utc::now(),
        };

        if let Err(e) = self.repo.save(&log).await {
            tracing::error!("Failed to save notification: {}", e);
        }

        if let Ok(mut con) = self.redis.get_multiplexed_async_connection().await {
            let cache_key = format!("notif:{}", order_id);
            if let Ok(json_str) = serde_json::to_string(&log) {
                let _: redis::RedisResult<()> = redis::AsyncCommands::set_ex(&mut con, cache_key, json_str, 600).await;
            }
        }

        Ok(NotifyResponse {
            status: "sent".to_string(),
            notification_id,
            order_id,
            channel: "email".to_string(),
        })
    }

    pub async fn get_status(&self, order_id: &str) -> Option<NotificationStatusResponse> {
        Self::simulate_sleep(1, 5).await;

        if let Ok(mut con) = self.redis.get_multiplexed_async_connection().await {
            let cache_key = format!("notif:{}", order_id);
            let cached: redis::RedisResult<String> = redis::AsyncCommands::get(&mut con, &cache_key).await;
            if let Ok(val) = cached {
                if let Ok(log) = serde_json::from_str::<NotificationLog>(&val) {
                    tracing::info!("Cache hit for order: {}", order_id);
                    return Some(NotificationStatusResponse {
                        notification_id: log.id,
                        order_id: log.order_id,
                        status: log.status,
                        sent_at: log.sent_at.to_rfc3339(),
                    });
                }
            }
        }

        tracing::info!("Cache miss for order: {}, querying DB", order_id);
        Self::simulate_sleep(10, 35).await;

        if let Ok(Some(log)) = self.repo.find_by_order_id(order_id).await {
            if let Ok(mut con) = self.redis.get_multiplexed_async_connection().await {
                let cache_key = format!("notif:{}", order_id);
                if let Ok(json_str) = serde_json::to_string(&log) {
                    let _: redis::RedisResult<()> = redis::AsyncCommands::set_ex(&mut con, cache_key, json_str, 600).await;
                }
            }
            return Some(NotificationStatusResponse {
                notification_id: log.id,
                order_id: log.order_id,
                status: log.status,
                sent_at: log.sent_at.to_rfc3339(),
            });
        }

        None
    }
}
