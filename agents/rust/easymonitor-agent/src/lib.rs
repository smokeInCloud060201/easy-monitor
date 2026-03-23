use opentelemetry::KeyValue;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::propagation::TraceContextPropagator;
use opentelemetry_sdk::trace as sdktrace;
use opentelemetry_sdk::Resource;

/// Initializes the EasyMonitor unified OpenTelemetry tracer and logger pipelines
pub fn init_telemetry(service_name: &str) -> sdktrace::Tracer {
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

    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("  🚀 [EasyMonitor] Rust Agent attached to {}!", service_name);
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    _tracer
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
