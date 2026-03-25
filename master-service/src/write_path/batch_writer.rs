use reqwest::Client;
use serde_json::json;
use shared_proto::logs::LogEntry;
use shared_proto::traces::Span;
use tokio::sync::mpsc;
use tokio::time::{self, Duration};
use tracing::{error, info};

use crate::utils::{sanitize_resource, is_error_span, extract_status_code};

/// Flush configuration for batch writers.
const FLUSH_MAX_ROWS: usize = 1000;
const FLUSH_INTERVAL_SECS: u64 = 2;

// ─── Logs Writer ───

pub async fn start_logs_writer(mut rx: mpsc::Receiver<Vec<LogEntry>>, ch_url: &str) {
    let client = Client::builder()
        .pool_max_idle_per_host(2)
        .timeout(Duration::from_secs(60))
        .build()
        .unwrap_or_default();

    info!("Write-path: logs batch writer started (flush at {} rows or {}s)", FLUSH_MAX_ROWS, FLUSH_INTERVAL_SECS);

    let mut batch: Vec<LogEntry> = Vec::with_capacity(FLUSH_MAX_ROWS);
    let mut interval = time::interval(Duration::from_secs(FLUSH_INTERVAL_SECS));

    loop {
        tokio::select! {
            maybe_logs = rx.recv() => {
                match maybe_logs {
                    Some(logs) => {
                        batch.extend(logs);
                        if batch.len() >= FLUSH_MAX_ROWS {
                            flush_logs(&client, ch_url, &mut batch).await;
                        }
                    }
                    None => {
                        // Channel closed — flush remaining and exit
                        if !batch.is_empty() {
                            flush_logs(&client, ch_url, &mut batch).await;
                        }
                        info!("Write-path: logs writer channel closed, exiting.");
                        break;
                    }
                }
            }
            _ = interval.tick() => {
                if !batch.is_empty() {
                    flush_logs(&client, ch_url, &mut batch).await;
                }
            }
        }
    }
}

async fn flush_logs(client: &Client, ch_url: &str, batch: &mut Vec<LogEntry>) {
    let count = batch.len();
    let mut payload = String::with_capacity(count * 256);

    for log in batch.drain(..) {
        let pod_id = log.tags.get("pod_id").cloned().unwrap_or_default();
        let namespace = log.tags.get("namespace").cloned().unwrap_or_default();
        let node_name = log.tags.get("node_name").cloned().unwrap_or_default();
        let host = log.tags.get("host").cloned().unwrap_or_default();
        let source = log.tags.get("source").cloned().unwrap_or_default();
        let span_id = log.tags.get("span_id").cloned().unwrap_or_default();

        // Build attributes JSON from remaining tags
        let known_keys = ["pod_id", "namespace", "node_name", "host", "source", "span_id"];
        let extra_attrs: serde_json::Map<String, serde_json::Value> = log
            .tags
            .iter()
            .filter(|(k, _)| !known_keys.contains(&k.as_str()))
            .map(|(k, v)| (k.clone(), serde_json::Value::String(v.clone())))
            .collect();
        let attributes_json =
            serde_json::to_string(&extra_attrs).unwrap_or_else(|_| "{}".to_string());

        let row = json!({
            "trace_id": log.trace_id,
            "span_id": span_id,
            "service": log.service,
            "level": log.level.to_uppercase(),
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

    let url = format!(
        "{}&query=INSERT INTO easy_monitor_logs FORMAT JSONEachRow",
        ch_url
    );
    match client.post(&url).body(payload).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                info!("Write-path: flushed {} logs to ClickHouse", count);
            } else {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                error!("Write-path: logs flush HTTP {}: {}", status, body);
            }
        }
        Err(e) => error!("Write-path: logs flush failed: {}", e),
    }
}

// ─── Traces Writer ───

pub async fn start_traces_writer(mut rx: mpsc::Receiver<Vec<Span>>, ch_url: &str) {
    let client = Client::builder()
        .pool_max_idle_per_host(2)
        .timeout(Duration::from_secs(60))
        .build()
        .unwrap_or_default();

    info!("Write-path: traces batch writer started (flush at {} rows or {}s)", FLUSH_MAX_ROWS, FLUSH_INTERVAL_SECS);

    let mut batch: Vec<Span> = Vec::with_capacity(FLUSH_MAX_ROWS);
    let mut interval = time::interval(Duration::from_secs(FLUSH_INTERVAL_SECS));

    loop {
        tokio::select! {
            maybe_spans = rx.recv() => {
                match maybe_spans {
                    Some(spans) => {
                        batch.extend(spans);
                        if batch.len() >= FLUSH_MAX_ROWS {
                            flush_traces(&client, ch_url, &mut batch).await;
                        }
                    }
                    None => {
                        if !batch.is_empty() {
                            flush_traces(&client, ch_url, &mut batch).await;
                        }
                        info!("Write-path: traces writer channel closed, exiting.");
                        break;
                    }
                }
            }
            _ = interval.tick() => {
                if !batch.is_empty() {
                    flush_traces(&client, ch_url, &mut batch).await;
                }
            }
        }
    }
}

async fn flush_traces(client: &Client, ch_url: &str, batch: &mut Vec<Span>) {
    let count = batch.len();
    let mut payload = String::with_capacity(count * 256);

    for span in batch.drain(..) {
        let sanitized_resource = sanitize_resource(&span.resource);
        let sanitized_name = sanitize_resource(&span.name);
        let attributes_json =
            serde_json::to_string(&span.meta).unwrap_or_else(|_| "{}".to_string());

        // Override error flag: count 4xx/5xx HTTP responses as errors
        let effective_error = if is_error_span(span.error, &span.meta) { 1 } else { 0 };
        let status_code = extract_status_code(&span.meta);

        let row = json!({
            "trace_id": span.trace_id,
            "span_id": span.span_id,
            "parent_id": span.parent_id,
            "service": span.service,
            "name": sanitized_name,
            "resource": sanitized_resource,
            "error": effective_error,
            "status_code": status_code,
            "duration": span.duration,
            "timestamp": span.start_time,
            "attributes": attributes_json,
        });
        payload.push_str(&row.to_string());
        payload.push('\n');
    }

    let url = format!(
        "{}&query=INSERT INTO easy_monitor_traces FORMAT JSONEachRow",
        ch_url
    );
    match client.post(&url).body(payload).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                info!("Write-path: flushed {} traces to ClickHouse", count);
            } else {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                error!("Write-path: traces flush HTTP {}: {}", status, body);
            }
        }
        Err(e) => error!("Write-path: traces flush failed: {}", e),
    }
}
