use sqlx::PgPool;
use crate::domain::InventoryLog;

pub struct InventoryRepository {
    pool: PgPool,
}

impl InventoryRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn init_schema(&self) -> Result<(), sqlx::Error> {
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS inventory_logs (
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

    pub async fn save(&self, log: &InventoryLog) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO inventory_logs (id, order_id, recipient, channel, status, sent_at)
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

    pub async fn find_by_order_id(&self, order_id: &str) -> Result<Option<InventoryLog>, sqlx::Error> {
        let log = sqlx::query_as::<_, InventoryLog>(
            "SELECT id, order_id, recipient, channel, status, sent_at FROM inventory_logs WHERE order_id = $1 LIMIT 1"
        )
        .bind(order_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(log)
    }
}
