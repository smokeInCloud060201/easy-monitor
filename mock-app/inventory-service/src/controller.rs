use actix_web::{web, HttpResponse};
use crate::domain::{HealthResponse};
use crate::service::InventoryService;
use std::sync::Arc;

pub async fn handle_get_inventory(
    service: web::Data<Arc<InventoryService>>,
    path: web::Path<String>,
) -> HttpResponse {
    let product_id = path.into_inner();
    
    if let Some(status) = service.get_status(&product_id).await {
        HttpResponse::Ok().json(status)
    } else {
        HttpResponse::NotFound().json(serde_json::json!({"error": "Inventory not found"}))
    }
}

pub async fn handle_health() -> HttpResponse {
    HttpResponse::Ok().json(HealthResponse {
        status: "healthy".to_string(),
        service: "inventory-service (DDD)".to_string(),
    })
}
