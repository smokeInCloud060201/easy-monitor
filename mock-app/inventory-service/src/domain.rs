use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct InventoryLog {
    pub id: String,
    pub order_id: String,
    pub recipient: String,
    pub channel: String,
    pub status: String,
    pub sent_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct NotifyRequest {
    pub order_id: Option<String>,
    pub email: Option<String>,
    pub r#type: Option<String>,
    #[allow(dead_code)]
    pub total: Option<f64>,
}

#[derive(Serialize)]
pub struct NotifyResponse {
    pub status: String,
    pub inventory_id: String,
    pub order_id: String,
    pub channel: String,
}

#[derive(Serialize)]
pub struct InventoryStatusResponse {
    pub inventory_id: String,
    pub order_id: String,
    pub status: String,
    pub sent_at: String,
}

#[derive(Serialize)]
pub struct HealthResponse { pub status: String, pub service: String }
