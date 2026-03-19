use std::sync::Arc;
use std::collections::HashMap;
use tokio::net::UdpSocket;
use tracing::{info, error};
use shared_proto::metrics::MetricPayload;
use crate::wal::WalBuffer;

pub async fn start_dogstatsd_server(wal: Arc<WalBuffer>) -> anyhow::Result<()> {
    let socket = UdpSocket::bind("127.0.0.1:8125").await?;
    info!("DogStatsD server listening on 127.0.0.1:8125");

    let mut buf = [0; 65536]; // Max UDP packet size

    loop {
        match socket.recv_from(&mut buf).await {
            Ok((len, _addr)) => {
                if let Ok(datagram) = std::str::from_utf8(&buf[..len]) {
                    // DogStatsD supports sending multiple metrics separated by unescaped newlines
                    for packet in datagram.lines() {
                        if let Some(metric) = parse_dogstatsd(packet) {
                            let wal_clone = wal.clone();
                            tokio::spawn(async move {
                                if let Err(e) = wal_clone.write_metric(metric).await {
                                    error!("WAL write error (DogStatsD): {}", e);
                                }
                            });
                        }
                    }
                }
            }
            Err(e) => error!("DogStatsD UDP receive error: {}", e),
        }
    }
}

// Format: metric.name:value|type|@sample_rate|#tags
// e.g. custom_metric:1|c|#env:prod,service:web
fn parse_dogstatsd(packet: &str) -> Option<MetricPayload> {
    let mut parts = packet.split('|');
    let name_and_val = parts.next()?;
    let mtype = parts.next()?;
    
    let mut nv_split = name_and_val.split(':');
    let name = nv_split.next()?.to_string();
    let value: f64 = nv_split.next()?.parse().ok()?;
    
    let mut tags = HashMap::new();
    for part in parts {
        if let Some(stripped) = part.strip_prefix('#') {
            for tag in stripped.split(',') {
                let mut tag_parts = tag.split(':');
                let k = tag_parts.next().unwrap_or("").to_string();
                let v = tag_parts.next().unwrap_or("").to_string();
                tags.insert(k, v);
            }
        }
    }

    Some(MetricPayload {
        name,
        value,
        r#type: mtype.to_string(), // Escaping 'type' because it's a Rust keyword
        tags,
        timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64,
    })
}
