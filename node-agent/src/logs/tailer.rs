use std::sync::Arc;
use std::path::Path;
use tracing::{info, error};
use tokio_stream::StreamExt;
use shared_proto::logs::LogEntry;
use crate::wal::WalBuffer;

pub async fn start_file_tailer(wal: Arc<WalBuffer>, log_dir: &str) -> anyhow::Result<()> {
    info!("Starting Node Agent Raw File Tailer on directory: {}", log_dir);
    
    let db_path = Path::new(log_dir);
    if !db_path.exists() {
        error!("Log directory does not exist: {}", log_dir);
        return Err(anyhow::anyhow!("Log directory not found"));
    }

    let mut lines = linemux::MuxedLines::new()?;
    
    // Add all existing *.log files
    for entry in std::fs::read_dir(db_path)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("log") {
            info!("Tailing log file: {:?}", path);
            lines.add_file(path).await?;
        }
    }

    // Keep track of the currently accumulated multi-line message per file
    let mut buffers: std::collections::HashMap<String, String> = std::collections::HashMap::new();

    while let Some(Ok(line_event)) = lines.next().await {
        let path_str = line_event.source().to_string_lossy().to_string();
        
        // Extract basic service name from filename (e.g. "payment.log" -> "payment-service")
        let file_name = Path::new(&path_str).file_name().and_then(|n| n.to_str()).unwrap_or("unknown");
        let mut service = file_name.strip_suffix(".log").unwrap_or(file_name).to_string();
        if !service.ends_with("-service") {
            service.push_str("-service");
        }

        let line = line_event.line().to_owned();

        // Check if the string starts with whitespace. (Java stack traces begin with \t or spaces)
        let is_continuation = line.starts_with(char::is_whitespace);

        if is_continuation {
            // Append to the existing buffer if there is one
            if let Some(buf) = buffers.get_mut(&service) {
                buf.push('\n');
                buf.push_str(&line);
            } else {
                // If there isn't a buffer, just start one
                buffers.insert(service, line);
            }
        } else {
            // It's a brand new log line! Flush the OLD buffer for this service natively to WAL
            if let Some(completed_message) = buffers.remove(&service) {
                flush_buffer(&wal, service.clone(), completed_message).await;
            }
            // Start a new buffer for the current incoming line
            buffers.insert(service, line);
        }
    }

    Ok(())
}

async fn flush_buffer(wal: &Arc<WalBuffer>, service: String, message: String) {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    let trace_id = uuid::Uuid::new_v4().to_string(); 
    
    // Simple greedy heuristic for finding Error severity
    let msg_lower = message.to_lowercase();
    let level = if msg_lower.contains("error") || msg_lower.contains("exception") {
        "ERROR".to_string()
    } else {
        "INFO".to_string()
    };

    let log_entry = LogEntry {
        service,
        level,
        message,
        tags: std::collections::HashMap::new(),
        trace_id,
        timestamp: ts,
    };
    
    if let Err(e) = wal.write_log(log_entry).await {
        error!("Failed to write File Tailer log to WAL natively: {}", e);
    }
}
