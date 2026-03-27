use sqlx::PgPool;
use crate::domain::NotificationLog;

pub struct NotificationRepository {
    pool: PgPool,
}

impl NotificationRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn init_schema(&self) -> Result<(), sqlx::Error> {
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS notification_logs (
                id VARCHAR(255) PRIMARY KEY,
                order_id VARCHAR(255) NOT NULL,
                recipient VARCHAR(255) NOT NULL,
                channel VARCHAR(255) NOT NULL,
                status VARCHAR(255) NOT NULL,
                sent_at TIMESTAMPTZ NOT NULL
            )"
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn save(&self, log: &NotificationLog) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO notification_logs (id, order_id, recipient, channel, status, sent_at)
             VALUES ($1, $2, $3, $4, $5, $6)"
        )
        .bind(&log.id)
        .bind(&log.order_id)
        .bind(&log.recipient)
        .bind(&log.channel)
        .bind(&log.status)
        .bind(log.sent_at)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn find_by_order_id(&self, order_id: &str) -> Result<Option<NotificationLog>, sqlx::Error> {
        let log = sqlx::query_as::<_, NotificationLog>(
            "SELECT id, order_id, recipient, channel, status, sent_at FROM notification_logs WHERE order_id = $1 LIMIT 1"
        )
        .bind(order_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(log)
    }
}
