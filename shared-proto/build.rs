use std::env;
use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());

    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
        .file_descriptor_set_path(out_dir.join("easy_monitor_descriptor.bin"))
        .compile(
            &[
                "proto/metrics.proto",
                "proto/logs.proto",
                "proto/traces.proto",
                "proto/opentelemetry/proto/collector/trace/v1/trace_service.proto",
                "proto/opentelemetry/proto/collector/metrics/v1/metrics_service.proto",
                "proto/opentelemetry/proto/collector/logs/v1/logs_service.proto",
            ],
            &["proto"],
        )?;

    Ok(())
}
