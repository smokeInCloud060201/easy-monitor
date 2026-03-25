use std::sync::Arc;
use tokio::net::UdpSocket;
use tracing::{info, error};
use shared_proto::logs::LogEntry;
use crate::wal::WalBuffer;pub mod tailer;

pub async fn start_log_tailer(wal: Arc<WalBuffer>, _log_dir: &str) -> anyhow::Result<()> {
    let port = 12201;
    info!("Starting Node Agent Graylog GELF Receiver on 0.0.0.0:{}", port);
    
    let socket = UdpSocket::bind(format!("0.0.0.0:{}", port)).await?;
    let mut buf = vec![0u8; 65535]; // Max UDP packet size

    loop {
        match socket.recv_from(&mut buf).await {
            Ok((len, src_addr)) => {
                if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&buf[..len]) {
                    let message = json.get("short_message").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let service = json.get("_service").and_then(|v| v.as_str()).unwrap_or("unknown-service").to_string();
                    let level = json.get("level").and_then(|v| v.as_i64()).map(|l| l.to_string()).unwrap_or_else(|| "INFO".to_string());
                    
                    let ts = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_millis() as i64;
                        
                    let trace_id = json.get("_trace_id").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or_else(|| uuid::Uuid::new_v4().to_string()); 

                    let mut tags = std::collections::HashMap::new();
                    
                    // Natively inherit dynamic tags passed by the application generically
                    if let Some(obj) = json.as_object() {
                        for (k, v) in obj {
                            if k.starts_with('_') && k != "_service" && k != "_trace_id" {
                                let key = k.strip_prefix('_').unwrap_or(k).to_string();
                                let val = v.as_str().unwrap_or(&v.to_string()).to_string();
                                tags.insert(key, val);
                            }
                        }
                    }
                    
                    // Fallbacks for contextual host natively mimicking gelf bounds
                    let host = json.get("host").and_then(|h| h.as_str()).unwrap_or("unknown-host").to_string();
                    tags.insert("host".to_string(), host);

                    let log_entry = LogEntry {
                        service,
                        level,
                        message,
                        tags,
                        trace_id,
                        timestamp: ts,
                    };
                    
                    if let Err(e) = wal.write_log(log_entry).await {
                        error!("Failed to write UDP log to WAL natively: {}", e);
                    }
                } else {
                    error!("Received invalid JSON GELF packet from {}", src_addr);
                }
            }
            Err(e) => {
                error!("UDP socket receive error: {}", e);
            }
        }
    }
}
