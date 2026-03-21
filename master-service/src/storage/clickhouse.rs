use std::sync::Arc;
use reqwest::Client;
use serde_json::json;
use tracing::{info, error};
use tokio::time::{self, Duration};
use crate::bus::{EventBusRx, Event};
use shared_proto::logs::LogEntry;
use shared_proto::traces::Span;

use super::CH_URL;
use crate::utils::sanitize_resource;

pub async fn initialize_clickhouse(client: &Client) -> anyhow::Result<()> {
    info!("Initializing ClickHouse schema definitions...");

    let create_logs = "
        CREATE TABLE IF NOT EXISTS easy_monitor_logs (
            trace_id String,
            span_id String DEFAULT '',
            service String,
            level String,
            message String,
            pod_id String,
            namespace String,
            node_name String,
            host String DEFAULT '',
            source String DEFAULT '',
            attributes String DEFAULT '{}',
            timestamp Int64
        ) ENGINE = MergeTree()
        ORDER BY (service, timestamp);
    ";

    // Idempotent migrations for existing tables
    let alter_logs_migrations = vec![
        "ALTER TABLE easy_monitor_logs ADD COLUMN IF NOT EXISTS span_id String DEFAULT ''",
        "ALTER TABLE easy_monitor_logs ADD COLUMN IF NOT EXISTS host String DEFAULT ''",
        "ALTER TABLE easy_monitor_logs ADD COLUMN IF NOT EXISTS source String DEFAULT ''",
        "ALTER TABLE easy_monitor_logs ADD COLUMN IF NOT EXISTS attributes String DEFAULT '{}'",
    ];

    let create_traces = "
        CREATE TABLE IF NOT EXISTS easy_monitor_traces (
            trace_id String,
            span_id String,
            parent_id String,
            service String,
            name String,
            resource String,
            error Int8,
            duration Int64,
            timestamp Int64
        ) ENGINE = MergeTree()
        ORDER BY (service, timestamp);
    ";

    let create_red_metrics = "
        CREATE TABLE IF NOT EXISTS easy_monitor_red_metrics (
            service String,
            resource String,
            timestamp Int64,
            requests Float64,
            errors Float64,
            duration_sum Float64,
            duration_avg Float64,
            duration_p50 Float64,
            duration_p95 Float64,
            duration_p99 Float64,
            count UInt64
        ) ENGINE = MergeTree()
        ORDER BY (service, resource, timestamp);
    ";

    client.post(CH_URL).body(create_logs.to_string()).send().await?.error_for_status()?;
    client.post(CH_URL).body(create_traces.to_string()).send().await?.error_for_status()?;
    client.post(CH_URL).body(create_red_metrics.to_string()).send().await?.error_for_status()?;

    // Run idempotent ALTER TABLE migrations for logs metadata columns
    for migration in alter_logs_migrations {
        let _ = client.post(CH_URL).body(migration.to_string()).send().await;
    }
    
    info!("ClickHouse OLAP tables initialized (logs, traces, red_metrics).");
    Ok(())
}

pub async fn start_clickhouse_writer(mut rx: EventBusRx) -> anyhow::Result<()> {
    let client = Client::new();
    
    // Attempt initialization but don't crash hard if DB isn't running yet, we can retry.
    let _ = initialize_clickhouse(&client).await.map_err(|e| error!("Failed initializing OLAP schema: {}", e));

    info!("Starting ClickHouse Asynchronous Storage Writer...");
    let mut logs_batch = Vec::new();
    let mut traces_batch = Vec::new();
    
    let mut interval = time::interval(Duration::from_secs(3));

    loop {
        tokio::select! {
            result = rx.recv() => {
                match result {
                    Ok(Event::Logs(logs)) => {
                        logs_batch.extend(logs);
                    }
                    Ok(Event::Traces(spans)) => {
                        traces_batch.extend(spans);
                    }
                    Ok(_) => {}
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                    Err(_) => {}
                }
            }
            _ = interval.tick() => {
                if !logs_batch.is_empty() {
                    let mut payload = String::new();
                    for log in logs_batch.drain(..) {
                        let pod_id = log.tags.get("pod_id").cloned().unwrap_or_default();
                        let namespace = log.tags.get("namespace").cloned().unwrap_or_default();
                        let node_name = log.tags.get("node_name").cloned().unwrap_or_default();
                        let host = log.tags.get("host").cloned().unwrap_or_default();
                        let source = log.tags.get("source").cloned().unwrap_or_default();
                        let span_id = log.tags.get("span_id").cloned().unwrap_or_default();

                        // Build attributes JSON from remaining tags
                        let known_keys = ["pod_id", "namespace", "node_name", "host", "source", "span_id"];
                        let extra_attrs: serde_json::Map<String, serde_json::Value> = log.tags.iter()
                            .filter(|(k, _)| !known_keys.contains(&k.as_str()))
                            .map(|(k, v)| (k.clone(), serde_json::Value::String(v.clone())))
                            .collect();
                        let attributes_json = serde_json::to_string(&extra_attrs).unwrap_or_else(|_| "{}".to_string());

                        let row = json!({
                            "trace_id": log.trace_id,
                            "span_id": span_id,
                            "service": log.service,
                            "level": log.level,
                            "message": log.message,
                            "pod_id": pod_id,
                            "namespace": namespace,
                            "node_name": node_name,
                            "host": host,
                            "source": source,
                            "attributes": attributes_json,
                            "timestamp": log.timestamp,
                        });
                        payload.push_str(&row.to_string());
                        payload.push('\n');
                    }
                    
                    let req = client.post(&format!("{}&query=INSERT INTO easy_monitor_logs FORMAT JSONEachRow", CH_URL))
                        .body(payload);
                    
                    if let Err(e) = req.send().await {
                        error!("ClickHouse logs flush explicitly failed: {}", e);
                    }
                }

                if !traces_batch.is_empty() {
                    let mut payload = String::new();
                    for span in traces_batch.drain(..) {
                        let sanitized_resource = sanitize_resource(&span.resource);
                        let sanitized_name = sanitize_resource(&span.name);
                        let row = json!({
                            "trace_id": span.trace_id,
                            "span_id": span.span_id,
                            "parent_id": span.parent_id,
                            "service": span.service,
                            "name": sanitized_name,
                            "resource": sanitized_resource,
                            "error": span.error,
                            "duration": span.duration,
                            "timestamp": span.start_time,
                        });
                        payload.push_str(&row.to_string());
                        payload.push('\n');
                    }
                    
                    let req = client.post(&format!("{}&query=INSERT INTO easy_monitor_traces FORMAT JSONEachRow", CH_URL))
                        .body(payload);
                    
                    if let Err(e) = req.send().await {
                        error!("ClickHouse traces flush explicitly failed: {}", e);
                    }
                }
            }
        }
    }

    Ok(())
}
