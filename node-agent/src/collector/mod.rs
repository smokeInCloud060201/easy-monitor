use std::sync::Arc;
use std::time::Duration;
use tokio::time;
use tracing::{info, error};
use sysinfo::System;
use shared_proto::metrics::MetricPayload;
use crate::wal::WalBuffer;

pub async fn start_collector_worker(wal: Arc<WalBuffer>) -> anyhow::Result<()> {
    info!("Starting Sysinfo Collector Worker...");
    let mut sys = System::new_all();
    let mut interval = time::interval(Duration::from_secs(10));

    // For file watching, we'd spawn a separate background task using `notify` here.
    // Implementing the sysinfo host metrics below:
    
    loop {
        interval.tick().await;
        sys.refresh_cpu_usage();
        sys.refresh_memory();
        
        let cpus = sys.cpus();
        let cpu_usage = if !cpus.is_empty() {
            cpus.iter().map(|c| c.cpu_usage()).sum::<f32>() / (cpus.len() as f32)
        } else {
            0.0
        };
        
        let mem_usage = sys.used_memory();
        
        let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
        
        let cpu_metric = MetricPayload {
            name: "system.cpu.usage".to_string(),
            value: cpu_usage as f64,
            r#type: "gauge".to_string(),
            tags: std::collections::HashMap::new(),
            timestamp: ts,
        };
        
        let mem_metric = MetricPayload {
            name: "system.mem.usage".to_string(),
            value: mem_usage as f64,
            r#type: "gauge".to_string(),
            tags: std::collections::HashMap::new(),
            timestamp: ts,
        };
        
        if let Err(e) = wal.write_metric(cpu_metric).await {
            error!("WAL write error (Sysinfo CPU): {}", e);
        }
        if let Err(e) = wal.write_metric(mem_metric).await {
            error!("WAL write error (Sysinfo Mem): {}", e);
        }
    }
}
