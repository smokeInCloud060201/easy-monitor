use std::sync::Arc;
use dashmap::DashMap;
use reqwest::Client;
use serde_json::json;
use tokio::time::{self, Duration};
use tracing::{info, error};

use shared_proto::metrics::MetricPayload;
use shared_proto::traces::Span;
use crate::bus::{EventBusTx, EventBusRx, Event};

use crate::storage::CH_URL;
use crate::utils::{sanitize_resource, is_error_span};

/// Per-resource aggregate bucket for one 10-second window
struct ResourceBucket {
    count: f64,
    errors: f64,
    durations: Vec<f64>,
}

impl ResourceBucket {
    fn new() -> Self {
        Self { count: 0.0, errors: 0.0, durations: Vec::new() }
    }
}

struct TopologyBucket {
    call_count: u64,
    errors: u64,
    durations: Vec<f64>,
}

impl TopologyBucket {
    fn new() -> Self { Self { call_count: 0, errors: 0, durations: Vec::new() } }
}

fn percentile(sorted: &[f64], p: f64) -> f64 {
    if sorted.is_empty() { return 0.0; }
    let idx = ((sorted.len() as f64 - 1.0) * p / 100.0).round() as usize;
    sorted[idx.min(sorted.len() - 1)]
}

pub async fn start_trace_metrics_engine(tx: EventBusTx, mut rx: EventBusRx) -> anyhow::Result<()> {
    info!("Starting Trace-to-Metrics Engine (RED + ClickHouse persistence)...");

    let buckets: Arc<DashMap<String, ResourceBucket>> = Arc::new(DashMap::new());
    let topology_buckets: Arc<DashMap<String, TopologyBucket>> = Arc::new(DashMap::new());

    let buckets_clone = buckets.clone();
    let topology_clone = topology_buckets.clone();
    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(Event::Traces(spans)) => {
                    for span in spans {
                        // Topology Edge extraction
                        if span.name.contains(".request") || span.name.contains(".client") {
                            if let Some(peer) = span.meta.get("peer.service") {
                                let edge_key = format!("{}->{}", span.service, peer);
                                let mut t_entry = topology_clone.entry(edge_key).or_insert_with(TopologyBucket::new);
                                t_entry.call_count += 1;
                                if is_error_span(span.error, &span.meta) {
                                    t_entry.errors += 1;
                                }
                                t_entry.durations.push(span.duration as f64 / 1000.0);
                            }
                        }

                        let sanitized_resource = sanitize_resource(&span.resource);
                        // EXCLUSIVE FILTER: Only track RED metrics for Entrypoint spans (Root spans or explicit APIs/Servers). 
                        // This prevents internal Redis/DB queries or background tasks from polluting the APM Resources endpoint list.
                        let is_api = (span.name.contains(".request") && !span.name.contains(".client")) || span.name.contains(".server") || span.name.contains("web.request");
                        if !is_api {
                            continue;
                        }
                        let key = format!("{}:{}", span.service, sanitized_resource);
                        let mut entry = buckets_clone.entry(key).or_insert_with(ResourceBucket::new);
                        entry.count += 1.0;
                        if is_error_span(span.error, &span.meta) {
                            entry.errors += 1.0;
                        }
                        entry.durations.push(span.duration as f64 / 1000.0); // μs → ms
                    }
                }
                Ok(_) => {},
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                Err(_) => continue,
            }
        }
    });

    let mut interval = time::interval(Duration::from_secs(10));
    let ch_client = Client::new();
    
    tokio::spawn(async move {
        loop {
            interval.tick().await;
            
            let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
            let mut payloads = Vec::new();
            let mut ch_payload = String::new();

            // Drain all buckets atomically
            let entries: Vec<(String, ResourceBucket)> = buckets.iter()
                .map(|entry| (entry.key().clone(), ResourceBucket {
                    count: entry.count,
                    errors: entry.errors,
                    durations: entry.durations.clone(),
                }))
                .collect();
            buckets.clear();

            for (key, mut bucket) in entries {
                let parts: Vec<&str> = key.splitn(2, ':').collect();
                let (service, resource) = if parts.len() == 2 {
                    (parts[0], parts[1])
                } else {
                    (parts[0], "unknown")
                };

                // Sort durations for percentile computation
                bucket.durations.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                let duration_sum: f64 = bucket.durations.iter().sum();
                let duration_avg = if bucket.count > 0.0 { duration_sum / bucket.count } else { 0.0 };
                let p50 = percentile(&bucket.durations, 50.0);
                let p95 = percentile(&bucket.durations, 95.0);
                let p99 = percentile(&bucket.durations, 99.0);

                // Publish in-memory metrics to event bus (existing behavior)
                let tags = std::collections::HashMap::new();
                let base_key = format!("apm.{}", key);
                payloads.push(MetricPayload {
                    name: format!("{}:rate", base_key),
                    value: bucket.count,
                    r#type: "rate".to_string(),
                    tags: tags.clone(),
                    timestamp: ts,
                });
                payloads.push(MetricPayload {
                    name: format!("{}:error", base_key),
                    value: bucket.errors,
                    r#type: "rate".to_string(),
                    tags: tags.clone(),
                    timestamp: ts,
                });
                payloads.push(MetricPayload {
                    name: format!("{}:duration_sum", base_key),
                    value: duration_sum,
                    r#type: "rate".to_string(),
                    tags: tags.clone(),
                    timestamp: ts,
                });

                // Build ClickHouse row for time-series persistence
                let row = json!({
                    "service": service,
                    "resource": resource,
                    "timestamp": ts,
                    "requests": bucket.count,
                    "errors": bucket.errors,
                    "duration_sum": duration_sum,
                    "duration_avg": duration_avg,
                    "duration_p50": p50,
                    "duration_p95": p95,
                    "duration_p99": p99,
                    "count": bucket.count as u64,
                });
                ch_payload.push_str(&row.to_string());
                ch_payload.push('\n');
            }

            // Publish to event bus
            if !payloads.is_empty() {
                info!("TraceEngine generated {} RED metrics", payloads.len());
                if let Err(e) = tx.send(Event::Metrics(payloads)) {
                    error!("TraceEngine failed to dispatch RED metrics: {}", e);
                }
            }

            // Persist to ClickHouse
            if !ch_payload.is_empty() {
                let req = ch_client.post(&format!("{}&query=INSERT INTO easy_monitor_red_metrics FORMAT JSONEachRow", CH_URL))
                    .body(ch_payload);
                if let Err(e) = req.send().await {
                    error!("TraceEngine ClickHouse RED persist failed: {}", e);
                }
            }

            // Drain topology buckets
            let t_entries: Vec<(String, TopologyBucket)> = topology_buckets.iter()
                .map(|entry| (entry.key().clone(), TopologyBucket {
                    call_count: entry.call_count,
                    errors: entry.errors,
                    durations: entry.durations.clone(),
                }))
                .collect();
            topology_buckets.clear();

            let mut topology_ch_payload = String::new();
            for (key, mut bucket) in t_entries {
                let parts: Vec<&str> = key.split("->").collect();
                if parts.len() != 2 { continue; }
                let parent_service = parts[0];
                let child_service = parts[1];

                bucket.durations.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                let p95 = percentile(&bucket.durations, 95.0);

                let row = json!({
                    "parent_service": parent_service,
                    "child_service": child_service,
                    "timestamp": ts,
                    "call_count": bucket.call_count,
                    "error_count": bucket.errors,
                    "p95_latency": p95,
                });
                topology_ch_payload.push_str(&row.to_string());
                topology_ch_payload.push('\n');
            }

            if !topology_ch_payload.is_empty() {
                let req = ch_client.post(&format!("{}&query=INSERT INTO easy_monitor_topology_edges FORMAT JSONEachRow", CH_URL))
                    .body(topology_ch_payload);
                if let Err(e) = req.send().await {
                    error!("TraceEngine ClickHouse Topology persist failed: {}", e);
                }
            }
        }
    });

    Ok(())
}
