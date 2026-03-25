use opentelemetry::KeyValue;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::propagation::TraceContextPropagator;
use opentelemetry_sdk::trace as sdktrace;
use opentelemetry_sdk::Resource;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::Registry;
use tracing_subscriber::Layer;
use tracing_subscriber::EnvFilter;
use std::net::UdpSocket;
use std::collections::BTreeMap;
use serde_json::Value;
use tracing::{Event, Subscriber};
use tracing_subscriber::layer::Context;
use tracing_opentelemetry::OpenTelemetrySpanExt;

pub mod actix_middleware;

/// Initializes the EasyMonitor unified OpenTelemetry tracer and logger pipelines
pub fn init_telemetry(service_name: &str) {
    // Trace exporter
    let trace_exporter = opentelemetry_otlp::new_exporter()
        .tonic()
        .with_endpoint("http://localhost:4317");

    let _tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(trace_exporter)
        .with_trace_config(
            sdktrace::config().with_resource(Resource::new(vec![
                KeyValue::new("service.name", service_name.to_string()),
            ])),
        )
        .install_batch(opentelemetry_sdk::runtime::Tokio)
        .expect("Failed to init tracer");



    // Set global propagator for W3C TraceContext
    opentelemetry::global::set_text_map_propagator(TraceContextPropagator::new());

    // Bind tracer and logger tightly, scoping filters locally to prevent global overrides!
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

    let telemetry = tracing_opentelemetry::layer().with_tracer(_tracer).with_filter(trace_filter);
    let log_layer = GelfLayer::new(service_name.to_string()).with_filter(log_filter);

    let subscriber = Registry::default()
        .with(telemetry)
        .with(log_layer);
        
    tracing::subscriber::set_global_default(subscriber).expect("Failed to install tracing subscriber");

    tracing::info!("  [EasyMonitor] Rust Agent attached to {}!", service_name);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
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
        socket.connect("127.0.0.1:12201").expect("Failed to connect GELF UDP");
        Self { socket, service_name }
    }
}

struct JsonVisitor<'a>(&'a mut BTreeMap<String, Value>);
impl<'a> tracing::field::Visit for JsonVisitor<'a> {
    fn record_f64(&mut self, field: &tracing::field::Field, value: f64) {
        self.0.insert(field.name().to_string(), Value::from(value));
    }
    fn record_i64(&mut self, field: &tracing::field::Field, value: i64) {
        self.0.insert(field.name().to_string(), Value::from(value));
    }
    fn record_u64(&mut self, field: &tracing::field::Field, value: u64) {
        self.0.insert(field.name().to_string(), Value::from(value));
    }
    fn record_bool(&mut self, field: &tracing::field::Field, value: bool) {
        self.0.insert(field.name().to_string(), Value::from(value));
    }
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        self.0.insert(field.name().to_string(), Value::from(value));
    }
    fn record_error(&mut self, field: &tracing::field::Field, value: &(dyn std::error::Error + 'static)) {
        self.0.insert(field.name().to_string(), Value::from(value.to_string()));
    }
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        self.0.insert(field.name().to_string(), Value::from(format!("{:?}", value)));
    }
}

impl<S: Subscriber + for<'a> tracing_subscriber::registry::LookupSpan<'a>> Layer<S> for GelfLayer {
    fn on_event(&self, event: &Event<'_>, ctx: Context<'_, S>) {
        let mut fields = BTreeMap::new();
        let mut visitor = JsonVisitor(&mut fields);
        event.record(&mut visitor);

        let msg = fields.remove("message").and_then(|v| v.as_str().map(|s| s.to_string())).unwrap_or_default();

        let mut trace_id = String::new();
        let mut span_id = String::new();

        if let Some(span) = ctx.lookup_current() {
            if let Some(ext) = span.extensions().get::<tracing_opentelemetry::OtelData>() {
                if let Some(tid) = ext.builder.trace_id {
                    trace_id = tid.to_string();
                }
                if let Some(sid) = ext.builder.span_id {
                    span_id = sid.to_string();
                }
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
