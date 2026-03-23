use actix_web::{web, App, HttpServer, HttpResponse, HttpRequest};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing_actix_web::TracingLogger;

#[derive(Deserialize)]
struct NotifyRequest {
    order_id: Option<String>,
    email: Option<String>,
    r#type: Option<String>,
    #[allow(dead_code)]
    total: Option<f64>,
}

#[derive(Serialize)]
struct NotifyResponse {
    status: String,
    notification_id: String,
    order_id: String,
    channel: String,
}

#[derive(Serialize)]
struct HealthResponse { status: String, service: String }

#[derive(Serialize)]
struct NotificationStatus {
    notification_id: String,
    order_id: String,
    status: String,
    sent_at: String,
}

fn init_telemetry() {
    easymonitor_agent::init_telemetry("notification-service");
}

async fn simulate_sleep(min_ms: u64, max_ms: u64) {
    let ms = { rand::thread_rng().gen_range(min_ms..=max_ms) };
    tokio::time::sleep(Duration::from_millis(ms)).await;
}

async fn handle_notify(_req: HttpRequest, body: web::Json<NotifyRequest>) -> HttpResponse {
    let order_id = body.order_id.clone().unwrap_or_else(|| "unknown".to_string());
    let email = body.email.clone().unwrap_or_else(|| "customer@example.com".to_string());
    let notify_type = body.r#type.clone().unwrap_or_else(|| "order_confirmation".to_string());
    let notification_id = format!("notif_{}", &uuid::Uuid::new_v4().to_string()[..8]);

    tracing::info!("POST /api/notify - order={} email={} type={}", order_id, email, notify_type);

    // Step 1: Lookup user preferences in DB
    simulate_sleep(10, 40).await;

    // Step 2: Render email template
    simulate_sleep(5, 15).await;
    let fail = { rand::thread_rng().gen::<f64>() < 0.03 };
    if fail {
        tracing::error!("POST /api/notify - template render failed order={}", order_id);
        return HttpResponse::InternalServerError().json(NotifyResponse {
            status: "failed".to_string(),
            notification_id,
            order_id,
            channel: "email".to_string(),
        });
    }

    // Step 3: SMTP send
    simulate_sleep(50, 200).await;
    let timeout = { rand::thread_rng().gen::<f64>() < 0.05 };
    if timeout {
        tracing::error!("POST /api/notify - SMTP timeout order={}", order_id);
        return HttpResponse::GatewayTimeout().json(NotifyResponse {
            status: "timeout".to_string(),
            notification_id,
            order_id,
            channel: "email".to_string(),
        });
    } else {
        tracing::info!("POST /api/notify - SMTP sent to={} order={}", email, order_id);
    }

    // Step 4: Record in DB
    simulate_sleep(8, 25).await;

    // Step 5: Update cache
    simulate_sleep(1, 5).await;

    tracing::info!("POST /api/notify - COMPLETED notification_id={} order={}", notification_id, order_id);

    HttpResponse::Ok().json(NotifyResponse {
        status: "sent".to_string(),
        notification_id,
        order_id,
        channel: "email".to_string(),
    })
}

async fn handle_get_notification(_req: HttpRequest, path: web::Path<String>) -> HttpResponse {
    let order_id = path.into_inner();

    tracing::info!("GET /api/notifications/{} - started", order_id);

    // Cache lookup
    simulate_sleep(1, 5).await;

    // DB fallback (30% cache miss)
    let miss = { rand::thread_rng().gen::<f64>() > 0.7 };
    if miss {
        tracing::info!("GET /api/notifications/{} - cache miss, querying DB", order_id);
        simulate_sleep(10, 35).await;
    }

    let safe_id = if order_id.len() > 4 { &order_id[4..order_id.len().min(12)] } else { &order_id };

    tracing::info!("GET /api/notifications/{} - 200 OK", order_id);

    HttpResponse::Ok().json(NotificationStatus {
        notification_id: format!("notif_{}", safe_id),
        order_id,
        status: "delivered".to_string(),
        sent_at: format!("{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()),
    })
}

async fn handle_health() -> HttpResponse {
    HttpResponse::Ok().json(HealthResponse {
        status: "healthy".to_string(),
        service: "notification-service".to_string(),
    })
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    init_telemetry();
    println!("[INFO] Notification Service (Rust) running on :8083");

    HttpServer::new(|| {
        App::new()
            .wrap(TracingLogger::default())
            .route("/api/notify", web::post().to(handle_notify))
            .route("/api/notifications/{order_id}", web::get().to(handle_get_notification))
            .route("/api/health", web::get().to(handle_health))
    })
    .bind("0.0.0.0:8083")?
    .run()
    .await
}
