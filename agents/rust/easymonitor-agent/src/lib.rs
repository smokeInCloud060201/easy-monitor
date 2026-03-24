use opentelemetry::KeyValue;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::propagation::TraceContextPropagator;
use opentelemetry_sdk::trace as sdktrace;
use opentelemetry_sdk::Resource;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::Registry;
use tracing_subscriber::Layer;
use tracing_subscriber::EnvFilter;

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

    // Log exporter
    let log_exporter = opentelemetry_otlp::new_exporter()
        .tonic()
        .with_endpoint("http://localhost:4317");

    let _log_provider = opentelemetry_otlp::new_pipeline()
        .logging()
        .with_exporter(log_exporter)
        .with_log_config(
            opentelemetry_sdk::logs::config().with_resource(Resource::new(vec![
                KeyValue::new("service.name", service_name.to_string()),
            ])),
        )
        .install_batch(opentelemetry_sdk::runtime::Tokio)
        .expect("Failed to init log provider");

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
    let log_layer = opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge::new(&_log_provider.provider().clone()).with_filter(log_filter);

    let subscriber = Registry::default()
        .with(telemetry)
        .with(log_layer);
        
    tracing::subscriber::set_global_default(subscriber).expect("Failed to install tracing subscriber");

    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("  [EasyMonitor] Rust Agent attached to {}!", service_name);
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
