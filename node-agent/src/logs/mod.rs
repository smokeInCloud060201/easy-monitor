use std::sync::Arc;
use std::path::PathBuf;
use std::collections::HashMap;
use std::time::Duration;
use tokio::fs::File;
use tokio::io::{AsyncSeekExt, AsyncBufReadExt, BufReader};
use tracing::{info, error};
use shared_proto::logs::LogEntry;
use crate::wal::WalBuffer;

pub async fn start_log_tailer(wal: Arc<WalBuffer>, log_dir: &str) -> anyhow::Result<()> {
    info!("Starting Log Tailer watching directory: {}", log_dir);
    tokio::fs::create_dir_all(log_dir).await?;

    let mut cursors: HashMap<PathBuf, u64> = HashMap::new();
    let mut interval = tokio::time::interval(Duration::from_millis(500));

    loop {
        interval.tick().await;

        let mut entries = match tokio::fs::read_dir(log_dir).await {
            Ok(e) => e,
            Err(err) => {
                error!("Failed to read log directory: {}", err);
                continue;
            }
        };

        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("log") {
                let current_pos = cursors.get(&path).copied().unwrap_or(0);
                
                let meta = match entry.metadata().await {
                    Ok(m) => m,
                    Err(_) => continue,
                };
                
                if meta.len() > current_pos {
                    if let Ok(mut file) = File::open(&path).await {
                        if file.seek(std::io::SeekFrom::Start(current_pos)).await.is_ok() {
                            let mut buf = String::new();
                            let mut reader = BufReader::new(file);
                            
                            while let Ok(bytes_read) = reader.read_line(&mut buf).await {
                                if bytes_read == 0 { break; }
                                
                                let service_name = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
                                
                                let ts = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap()
                                    .as_millis() as i64;
                                    
                                let trace_id = uuid::Uuid::new_v4().to_string(); 
                                
                                let mut tags = std::collections::HashMap::new();
                                tags.insert("pod_id".to_string(), std::env::var("POD_ID").unwrap_or_else(|_| "unknown-pod".to_string()));
                                tags.insert("namespace".to_string(), std::env::var("KUBE_NAMESPACE").unwrap_or_else(|_| "default".to_string()));
                                tags.insert("node_name".to_string(), std::env::var("NODE_NAME").unwrap_or_else(|_| "localhost".to_string()));

                                let log_entry = LogEntry {
                                    service: service_name,
                                    level: "INFO".to_string(), // Mock baseline
                                    message: buf.trim_end().to_string(),
                                    tags,
                                    trace_id,
                                    timestamp: ts,
                                };
                                
                                if let Err(e) = wal.write_log(log_entry).await {
                                    error!("Failed to write log to WAL: {}", e);
                                }
                                
                                buf.clear();
                            }
                            
                            if let Ok(new_pos) = reader.seek(std::io::SeekFrom::Current(0)).await {
                                cursors.insert(path.clone(), new_pos);
                            }
                        }
                    }
                } else if meta.len() < current_pos {
                    // File was truncated/rotated
                    cursors.insert(path.clone(), 0);
                }
            }
        }
    }
}
