use actix_web::{web, App, HttpServer, HttpResponse, HttpRequest};
use opentelemetry::trace::{Span, Tracer, SpanKind, Status, TraceContextExt};
use opentelemetry::{Context, KeyValue};
use opentelemetry::propagation::TextMapPropagator;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::propagation::TraceContextPropagator;
use opentelemetry_sdk::trace as sdktrace;
use opentelemetry_sdk::Resource;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

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

fn init_tracer() {
    let exporter = opentelemetry_otlp::new_exporter()
        .tonic()
        .with_endpoint("http://localhost:4317");

    let _tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(exporter)
        .with_trace_config(
            sdktrace::config().with_resource(Resource::new(vec![
                KeyValue::new("service.name", "notification-service"),
            ])),
        )
        .install_batch(opentelemetry_sdk::runtime::Tokio)
        .expect("Failed to init tracer");

    // Set global propagator for W3C TraceContext
    opentelemetry::global::set_text_map_propagator(TraceContextPropagator::new());
}

async fn simulate_sleep(min_ms: u64, max_ms: u64) {
    let ms = { rand::thread_rng().gen_range(min_ms..=max_ms) };
    tokio::time::sleep(Duration::from_millis(ms)).await;
}

/// Extract W3C trace context from incoming HTTP request headers
fn extract_context(req: &HttpRequest) -> Context {
    let propagator = TraceContextPropagator::new();
    let mut carrier = HashMap::new();
    for (key, value) in req.headers() {
        if let (Ok(k), Ok(v)) = (key.as_str().parse::<String>(), value.to_str()) {
            carrier.insert(k, v.to_string());
        }
    }
    propagator.extract(&carrier)
}

async fn handle_notify(req: HttpRequest, body: web::Json<NotifyRequest>) -> HttpResponse {
    let parent_ctx = extract_context(&req);
    let tracer = opentelemetry::global::tracer("notification-service");
    let order_id = body.order_id.clone().unwrap_or_else(|| "unknown".to_string());
    let email = body.email.clone().unwrap_or_else(|| "customer@example.com".to_string());
    let notify_type = body.r#type.clone().unwrap_or_else(|| "order_confirmation".to_string());
    let notification_id = format!("notif_{}", &uuid::Uuid::new_v4().to_string()[..8]);

    println!("[INFO] POST /api/notify - order={} email={} type={}", order_id, email, notify_type);

    // Create root span as child of incoming context
    let mut root = tracer.span_builder("POST /api/notify")
        .with_kind(SpanKind::Server)
        .start_with_context(&tracer, &parent_ctx);

    // Step 1: Lookup user preferences in DB
    {
        let mut span = tracer.span_builder("db.query SELECT user_preferences")
            .with_kind(SpanKind::Internal).start(&tracer);
        span.set_attribute(KeyValue::new("db.system", "postgresql"));
        span.set_attribute(KeyValue::new("db.operation", "SELECT"));
        span.set_attribute(KeyValue::new("db.sql.table", "user_preferences"));
        span.set_attribute(KeyValue::new("db.statement",
            format!("SELECT * FROM user_preferences WHERE email = '{}'", email)));
        simulate_sleep(10, 40).await;
        span.set_status(Status::Ok);
        span.end();
    }

    // Step 2: Render email template
    {
        let mut span = tracer.span_builder("render_template")
            .with_kind(SpanKind::Internal).start(&tracer);
        span.set_attribute(KeyValue::new("template.type", notify_type.clone()));
        span.set_attribute(KeyValue::new("template.order_id", order_id.clone()));
        simulate_sleep(5, 15).await;
        let fail = { rand::thread_rng().gen::<f64>() < 0.01 };
        if fail {
            span.set_status(Status::error("Template render failed"));
        } else {
            span.set_status(Status::Ok);
        }
        span.end();
    }

    // Step 3: SMTP send
    {
        let mut span = tracer.span_builder("smtp.send")
            .with_kind(SpanKind::Client).start(&tracer);
        span.set_attribute(KeyValue::new("smtp.to", email.clone()));
        span.set_attribute(KeyValue::new("smtp.subject",
            format!("Order {} - {}", order_id, notify_type)));
        span.set_attribute(KeyValue::new("smtp.provider", "sendgrid"));
        simulate_sleep(50, 200).await;
        let timeout = { rand::thread_rng().gen::<f64>() < 0.03 };
        if timeout {
            println!("[ERROR] POST /api/notify - SMTP timeout order={}", order_id);
            span.set_status(Status::error("SMTP connection timeout"));
        } else {
            println!("[INFO] POST /api/notify - SMTP sent to={} order={}", email, order_id);
            span.set_status(Status::Ok);
        }
        span.end();
    }

    // Step 4: Record in DB
    {
        let mut span = tracer.span_builder("db.query INSERT notifications")
            .with_kind(SpanKind::Internal).start(&tracer);
        span.set_attribute(KeyValue::new("db.system", "postgresql"));
        span.set_attribute(KeyValue::new("db.operation", "INSERT"));
        span.set_attribute(KeyValue::new("db.sql.table", "notifications"));
        span.set_attribute(KeyValue::new("db.statement",
            format!("INSERT INTO notifications (id, order_id, type, status) VALUES ('{}', '{}', '{}', 'sent')",
                notification_id, order_id, notify_type)));
        simulate_sleep(8, 25).await;
        span.set_status(Status::Ok);
        span.end();
    }

    // Step 5: Update cache
    {
        let mut span = tracer.span_builder(format!("cache.SET notification:{}", order_id))
            .with_kind(SpanKind::Client).start(&tracer);
        span.set_attribute(KeyValue::new("cache.system", "redis"));
        span.set_attribute(KeyValue::new("cache.operation", "SET"));
        span.set_attribute(KeyValue::new("cache.key", format!("notification:{}", order_id)));
        simulate_sleep(1, 5).await;
        span.set_status(Status::Ok);
        span.end();
    }

    root.set_status(Status::Ok);
    root.end();

    println!("[INFO] POST /api/notify - COMPLETED notification_id={} order={}", notification_id, order_id);

    HttpResponse::Ok().json(NotifyResponse {
        status: "sent".to_string(),
        notification_id,
        order_id,
        channel: "email".to_string(),
    })
}

async fn handle_get_notification(req: HttpRequest, path: web::Path<String>) -> HttpResponse {
    let parent_ctx = extract_context(&req);
    let order_id = path.into_inner();
    let tracer = opentelemetry::global::tracer("notification-service");

    let mut root = tracer.span_builder(format!("GET /api/notifications/{}", order_id))
        .with_kind(SpanKind::Server)
        .start_with_context(&tracer, &parent_ctx);

    println!("[INFO] GET /api/notifications/{} - started", order_id);

    // Cache lookup
    {
        let mut span = tracer.span_builder(format!("cache.GET notification:{}", order_id))
            .with_kind(SpanKind::Client).start(&tracer);
        span.set_attribute(KeyValue::new("cache.system", "redis"));
        span.set_attribute(KeyValue::new("cache.operation", "GET"));
        simulate_sleep(1, 5).await;
        span.set_status(Status::Ok);
        span.end();
    }

    // DB fallback (30% cache miss)
    let miss = { rand::thread_rng().gen::<f64>() > 0.7 };
    if miss {
        let mut span = tracer.span_builder("db.query SELECT notifications")
            .with_kind(SpanKind::Internal).start(&tracer);
        span.set_attribute(KeyValue::new("db.system", "postgresql"));
        span.set_attribute(KeyValue::new("db.statement",
            format!("SELECT * FROM notifications WHERE order_id = '{}'", order_id)));
        simulate_sleep(10, 35).await;
        span.set_status(Status::Ok);
        span.end();
    }

    let safe_id = if order_id.len() > 4 { &order_id[4..order_id.len().min(12)] } else { &order_id };

    root.set_status(Status::Ok);
    root.end();

    println!("[INFO] GET /api/notifications/{} - 200 OK", order_id);

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
    init_tracer();
    println!("Notification Service (Rust) running on :8083");

    HttpServer::new(|| {
        App::new()
            .route("/api/notify", web::post().to(handle_notify))
            .route("/api/notifications/{order_id}", web::get().to(handle_get_notification))
            .route("/api/health", web::get().to(handle_health))
    })
    .bind("0.0.0.0:8083")?
    .run()
    .await
}
