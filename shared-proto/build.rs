use std::env;
use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());

    tonic_build::configure()
        .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
        .file_descriptor_set_path(out_dir.join("protobuf_descriptor.bin"))
        .compile(
            &[
                "proto/traces.proto",
                "proto/metrics.proto",
                "proto/logs.proto",
            ],
            &["proto"],
        )?;

    Ok(())
}
