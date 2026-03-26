use sqlx::PgPool;

pub struct InventoryRepository {
    pool: PgPool,
}

impl InventoryRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    #[tracing::instrument(name = "db.query", skip_all, fields(db.statement = "CREATE TABLE IF NOT EXISTS inventory"))]
    pub async fn init_schema(&self) -> Result<(), sqlx::Error> {
        // Table already seeded by seed.sql but keep IF NOT EXISTS
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS inventory (
                product_id VARCHAR(50) PRIMARY KEY,
                stock_qty INT DEFAULT 0,
                warehouse_location VARCHAR(100)
            )"
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    #[tracing::instrument(name = "db.query", skip_all, fields(db.statement = "SELECT product_id, stock_qty, warehouse_location FROM inventory WHERE product_id = $1"))]
    pub async fn find_product_inventory(&self, product_id: &str) -> Result<Option<crate::domain::Inventory>, sqlx::Error> {
        let inv = sqlx::query_as::<_, crate::domain::Inventory>(
            "SELECT product_id, stock_qty, warehouse_location FROM inventory WHERE product_id = $1"
        )
        .bind(product_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(inv)
    }
}
