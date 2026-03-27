use rand::Rng;
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::net::UdpSocket;
use std::time::SystemTime;
use tracing::{Event, Subscriber};
use tracing_subscriber::layer::Context;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::{EnvFilter, Layer, Registry};

pub mod actix_middleware;
pub mod reqwest_middleware;

#[derive(Debug, Serialize, Clone)]
pub struct DatadogSpan {
    pub trace_id: u64,
    pub span_id: u64,
    pub parent_id: u64,
    pub name: String,
    pub resource: String,
    pub service: String,
    pub r#type: String,
    pub start: i64,
    pub duration: i64,
    pub error: i32,
    pub meta: HashMap<String, String>,
    pub metrics: HashMap<String, f64>,
}

#[derive(Clone, Debug)]
pub struct SpanData {
    pub trace_id: u64,
    pub span_id: u64,
    pub parent_id: u64,
    pub start_time: SystemTime,
    pub error: i32,
    pub meta: HashMap<String, String>,
}

pub struct DatadogTracingLayer {
    service_name: String,
    resource_meta: HashMap<String, String>,
    sender: tokio::sync::mpsc::Sender<DatadogSpan>,
}

impl DatadogTracingLayer {
    pub fn new(service_name: String) -> Self {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<DatadogSpan>(1000);
        
        let mut resource_meta = HashMap::new();
        if let Ok(attrs) = std::env::var("OTEL_RESOURCE_ATTRIBUTES") {
            for pair in attrs.split(',') {
                let mut kv = pair.splitn(2, '=');
                if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
                    if k == "deployment.environment" {
                        resource_meta.insert("env".to_string(), v.to_string());
                    } else if k == "service.version" {
                        resource_meta.insert("version".to_string(), v.to_string());
                    }
                }
            }
        }

        tokio::spawn(async move {
            let worker_client = reqwest::Client::new();
            let worker_endpoint = "http://127.0.0.1:8126/v0.4/traces".to_string();
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(1));
            let mut batch = Vec::new();

            loop {
                tokio::select! {
                    _ = interval.tick() => {
                        if !batch.is_empty() {
                            let payload = vec![batch.clone()];
                            if let Ok(body) = rmp_serde::to_vec_named(&payload) {
                                let _ = worker_client.post(&worker_endpoint)
                                    .header("Content-Type", "application/msgpack")
                                    .body(body)
                                    .send()
                                    .await;
                            }
                            batch.clear();
                        }
                    }
                    Some(span) = rx.recv() => {
                        batch.push(span);
                        if batch.len() >= 100 {
                            let payload = vec![batch.clone()];
                            if let Ok(body) = rmp_serde::to_vec_named(&payload) {
                                let _ = worker_client.post(&worker_endpoint)
                                    .header("Content-Type", "application/msgpack")
                                    .body(body)
                                    .send()
                                    .await;
                            }
                            batch.clear();
                        }
                    }
                }
            }
        });

        Self {
            service_name,
            resource_meta,
            sender: tx,
        }
    }
}

impl<S> Layer<S> for DatadogTracingLayer
where
    S: Subscriber + for<'a> tracing_subscriber::registry::LookupSpan<'a>,
{
    fn on_new_span(
        &self,
        attrs: &tracing::span::Attributes<'_>,
        id: &tracing::Id,
        ctx: Context<'_, S>,
    ) {
        let span = ctx.span(id).expect("Span not found");
        let mut meta = HashMap::new();

        let mut visitor = TagVisitor(&mut meta);
        attrs.record(&mut visitor);

        let ext_trace_id = meta
            .get("trace_id")
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        let mut trace_id = if ext_trace_id != 0 {
            ext_trace_id
        } else {
            rand::thread_rng().gen::<u64>()
        };

        let mut parent_id = meta
            .get("parent_id")
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        let span_id = rand::thread_rng().gen::<u64>();

        meta.remove("trace_id");
        meta.remove("parent_id");

        if let Some(parent) = span.parent() {
            if let Some(ext) = parent.extensions().get::<SpanData>() {
                trace_id = ext.trace_id;
                parent_id = ext.span_id;
            }
        }

        let data = SpanData {
            trace_id,
            span_id,
            parent_id,
            start_time: SystemTime::now(),
            error: 0,
            meta,
        };

        span.extensions_mut().insert(data);
    }

    fn on_close(&self, id: tracing::Id, ctx: Context<'_, S>) {
        let span = ctx.span(&id).expect("Span not found");
        let data_opt = span.extensions_mut().remove::<SpanData>();
        if let Some(mut data) = data_opt {
            let duration = SystemTime::now()
                .duration_since(data.start_time)
                .unwrap_or_default()
                .as_nanos() as i64;
            let start = data
                .start_time
                .duration_since(SystemTime::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos() as i64;

            let mut span_type = "web".to_string();
            if let Some(stmt) = data.meta.get("db.statement") {
                span_type = "sql".to_string();
                if let Ok(re) = regex::Regex::new(r#"(['"]).*?\1|(\b\d+\b)"#) {
                    let obfuscated = re.replace_all(stmt, "?").to_string();
                    data.meta.insert("db.query".to_string(), obfuscated);
                }
            } else if data.meta.contains_key("http.url") && !data.meta.contains_key("http.route") {
                span_type = "http".to_string();
            }

            for (k, v) in &self.resource_meta {
                data.meta.insert(k.clone(), v.clone());
            }

            let dd_span = DatadogSpan {
                trace_id: data.trace_id,
                span_id: data.span_id,
                parent_id: data.parent_id,
                name: span.name().to_string(),
                resource: span.name().to_string(),
                service: self.service_name.clone(),
                r#type: span_type,
                start,
                duration,
                error: data.error,
                meta: data.meta,
                metrics: HashMap::new(),
            };

            let sample_rate: f64 = 1.0;
            if data.error == 0 && rand::thread_rng().gen::<f64>() > sample_rate {
                return; // drop silently
            }

            let _ = self.sender.try_send(dd_span);
        }
    }

    fn on_event(&self, event: &tracing::Event<'_>, ctx: Context<'_, S>) {
        if event.metadata().target() == "sqlx::query" {
            let mut fields = HashMap::new();
            let mut visitor = TagVisitor(&mut fields);
            event.record(&mut visitor);

            let sql = fields.get("db.statement").cloned().unwrap_or_else(|| "unknown".to_string());
            let elapsed_secs: f64 = fields.get("elapsed_secs").and_then(|s| s.parse().ok()).unwrap_or(0.0);
            let duration: i64 = (elapsed_secs * 1_000_000_000.0) as i64;
            
            let mut trace_id = rand::thread_rng().gen::<u64>();
            let span_id = rand::thread_rng().gen::<u64>();
            let mut parent_id = 0;

            if let Some(span) = ctx.lookup_current() {
                if let Some(ext) = span.extensions().get::<SpanData>() {
                    trace_id = ext.trace_id;
                    parent_id = ext.span_id;
                }
            }

            let mut obfuscated = sql.clone();
            if let Ok(re) = regex::Regex::new(r#"(['"]).*?\1|(\b\d+\b)"#) {
                obfuscated = re.replace_all(&sql, "?").to_string();
            }

            let mut meta = fields.clone();
            meta.insert("db.query".to_string(), obfuscated.clone());
            meta.insert("db.system".to_string(), "sql".to_string());
            
            for (k, v) in &self.resource_meta {
                meta.insert(k.clone(), v.clone());
            }

            let end_time = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap_or_default().as_nanos() as i64;
            let start = end_time - duration;

            let dd_span = DatadogSpan {
                trace_id,
                span_id,
                parent_id,
                name: "db.query".to_string(),
                resource: obfuscated,
                service: self.service_name.clone(),
                r#type: "sql".to_string(),
                start,
                duration,
                error: 0,
                meta,
                metrics: HashMap::new(),
            };

            let _ = self.sender.try_send(dd_span);
        }
    }
}

// ─── GELF UDP LAYER ───

struct GelfLayer {
    socket: UdpSocket,
    service_name: String,
}

impl GelfLayer {
    fn new(service_name: String) -> Self {
        let socket = UdpSocket::bind("0.0.0.0:0").expect("Failed to bind UDP socket");
        let _ = socket.set_nonblocking(true);
        socket
            .connect("127.0.0.1:12201")
            .expect("Failed to connect GELF UDP");
        Self {
            socket,
            service_name,
        }
    }
}

fn truncate_string(mut s: String) -> String {
    if s.len() > 2000 {
        s.truncate(2000);
        s.push_str("... (truncated)");
    }
    s
}

struct JsonVisitor<'a>(&'a mut BTreeMap<String, serde_json::Value>);
impl<'a> tracing::field::Visit for JsonVisitor<'a> {
    fn record_f64(&mut self, field: &tracing::field::Field, value: f64) {
        self.0
            .insert(field.name().to_string(), serde_json::Value::from(value));
    }
    fn record_i64(&mut self, field: &tracing::field::Field, value: i64) {
        self.0
            .insert(field.name().to_string(), serde_json::Value::from(value));
    }
    fn record_u64(&mut self, field: &tracing::field::Field, value: u64) {
        self.0
            .insert(field.name().to_string(), serde_json::Value::from(value));
    }
    fn record_bool(&mut self, field: &tracing::field::Field, value: bool) {
        self.0
            .insert(field.name().to_string(), serde_json::Value::from(value));
    }
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        self.0.insert(
            field.name().to_string(),
            serde_json::Value::from(truncate_string(value.to_string())),
        );
    }
    fn record_error(
        &mut self,
        field: &tracing::field::Field,
        value: &(dyn std::error::Error + 'static),
    ) {
        self.0.insert(
            field.name().to_string(),
            serde_json::Value::from(truncate_string(value.to_string())),
        );
    }
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        self.0.insert(
            field.name().to_string(),
            serde_json::Value::from(truncate_string(format!("{:?}", value))),
        );
    }
}

struct TagVisitor<'a>(&'a mut HashMap<String, String>);
impl<'a> tracing::field::Visit for TagVisitor<'a> {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        self.0.insert(
            field.name().to_string(),
            truncate_string(format!("{:?}", value)),
        );
    }
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        self.0
            .insert(field.name().to_string(), truncate_string(value.to_string()));
    }
    fn record_u64(&mut self, field: &tracing::field::Field, value: u64) {
        self.0.insert(field.name().to_string(), value.to_string());
    }
    fn record_i64(&mut self, field: &tracing::field::Field, value: i64) {
        self.0.insert(field.name().to_string(), value.to_string());
    }
    fn record_f64(&mut self, field: &tracing::field::Field, value: f64) {
        self.0.insert(field.name().to_string(), value.to_string());
    }
    fn record_bool(&mut self, field: &tracing::field::Field, value: bool) {
        self.0.insert(field.name().to_string(), value.to_string());
    }
}

impl<S: Subscriber + for<'a> tracing_subscriber::registry::LookupSpan<'a>> Layer<S> for GelfLayer {
    fn on_event(&self, event: &Event<'_>, ctx: Context<'_, S>) {
        let mut fields = BTreeMap::new();
        let mut visitor = JsonVisitor(&mut fields);
        event.record(&mut visitor);

        let msg = fields
            .remove("message")
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_default();

        let mut trace_id = String::new();
        let mut span_id = String::new();

        if let Some(span) = ctx.lookup_current() {
            if let Some(ext) = span.extensions().get::<SpanData>() {
                trace_id = format!("{:16x}", ext.trace_id);
                span_id = format!("{:16x}", ext.span_id);
            }
        }

        let level_num = match *event.metadata().level() {
            tracing::Level::ERROR => 3,
            tracing::Level::WARN => 4,
            tracing::Level::INFO => 6,
            tracing::Level::DEBUG => 7,
            tracing::Level::TRACE => 7,
        };

        if let Ok(ts) = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
            let timestamp = ts.as_secs_f64();
            let payload = serde_json::json!({
                "version": "1.1",
                "host": "local",
                "short_message": msg,
                "timestamp": timestamp,
                "level": level_num,
                "_service": self.service_name,
                "_trace_id": trace_id,
                "_span_id": span_id,
            });

            if let Ok(bytes) = serde_json::to_vec(&payload) {
                let _ = self.socket.send(&bytes);
            }
        }
    }
}

pub fn init_telemetry(service_name: &str) {
    let trace_filter = EnvFilter::new("trace")
        .add_directive("h2=off".parse().unwrap())
        .add_directive("hyper=off".parse().unwrap())
        .add_directive("tonic=off".parse().unwrap())
        .add_directive("reqwest=off".parse().unwrap())
        .add_directive("mio=off".parse().unwrap());

    let log_filter = EnvFilter::new("info")
        .add_directive("h2=off".parse().unwrap())
        .add_directive("hyper=off".parse().unwrap())
        .add_directive("tonic=off".parse().unwrap())
        .add_directive("reqwest=off".parse().unwrap())
        .add_directive("mio=off".parse().unwrap());

    let telemetry = DatadogTracingLayer::new(service_name.to_string()).with_filter(trace_filter);
    let log_layer = GelfLayer::new(service_name.to_string()).with_filter(log_filter);

    let subscriber = Registry::default().with(telemetry).with(log_layer);

    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to install tracing subscriber");

    tracing::info!(
        "  [EasyMonitor] Native Rust Agent attached to {}!",
        service_name
    );
}
