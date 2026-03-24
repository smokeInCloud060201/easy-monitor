use actix_web::{web, HttpResponse};
use crate::domain::{NotifyRequest, HealthResponse, NotifyResponse};
use crate::service::InventoryService;
use std::sync::Arc;

pub async fn handle_notify(
    service: web::Data<Arc<InventoryService>>,
    body: web::Json<NotifyRequest>,
) -> HttpResponse {
    let order_id = body.order_id.clone().unwrap_or_else(|| "unknown".to_string());
    
    match service.process_inventory(body.into_inner()).await {
        Ok(res) => HttpResponse::Ok().json(res),
        Err(e) => {
            if e == "SMTP timeout" {
                HttpResponse::GatewayTimeout().json(NotifyResponse {
                    status: "timeout".to_string(),
                    inventory_id: "none".to_string(),
                    order_id,
                    channel: "email".to_string(),
                })
            } else {
                HttpResponse::InternalServerError().json(NotifyResponse {
                    status: "failed".to_string(),
                    inventory_id: "none".to_string(),
                    order_id,
                    channel: "email".to_string(),
                })
            }
        }
    }
}

pub async fn handle_get_inventory(
    service: web::Data<Arc<InventoryService>>,
    path: web::Path<String>,
) -> HttpResponse {
    let order_id = path.into_inner();
    
    if let Some(status) = service.get_status(&order_id).await {
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
