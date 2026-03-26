use std::sync::Arc;
use std::time::Duration;
use tokio::time;
use tonic::transport::{Channel, ClientTlsConfig, Certificate, Identity};
use tracing::{info, error, debug};

use shared_proto::metrics::{metrics_service_client::MetricsServiceClient, SyncMetricsRequest, MetricPayload};
use shared_proto::logs::{logs_service_client::LogsServiceClient, SyncLogsRequest, LogEntry};
use shared_proto::traces::{traces_service_client::TracesServiceClient, SyncTracesRequest, Span};

use crate::wal::{WalBuffer, BATCH_THRESHOLD};

/// Kafka-style batch size per flush. Matches WAL threshold.
const BATCH_SIZE: usize = BATCH_THRESHOLD;

/// Timer interval (seconds) — flush even if batch isn't full.
const FLUSH_INTERVAL_SECS: u64 = 30;

pub async fn start_forwarder_worker(wal: Arc<WalBuffer>) -> anyhow::Result<()> {
    info!(
        "Starting node-agent Forwarder Worker (batch_size={}, flush_interval={}s)",
        BATCH_SIZE, FLUSH_INTERVAL_SECS
    );
    
    let server_root_ca_cert = std::fs::read_to_string("../certs/ca.pem")?;
    let server_root_ca_cert = Certificate::from_pem(server_root_ca_cert);
    let client_cert = std::fs::read_to_string("../certs/client.pem")?;
    let client_key = std::fs::read_to_string("../certs/client.key")?;
    let client_identity = Identity::from_pem(client_cert, client_key);

    let tls = ClientTlsConfig::new()
        .domain_name("localhost")
        .ca_certificate(server_root_ca_cert)
        .identity(client_identity);

    let channel = Channel::from_static("https://127.0.0.1:50051")
        .tls_config(tls)?
        .connect_lazy();

    let mut metrics_client = MetricsServiceClient::new(channel.clone())
        .send_compressed(tonic::codec::CompressionEncoding::Gzip);
    let mut logs_client = LogsServiceClient::new(channel.clone())
        .send_compressed(tonic::codec::CompressionEncoding::Gzip);
    let mut traces_client = TracesServiceClient::new(channel)
        .send_compressed(tonic::codec::CompressionEncoding::Gzip);

    let mut interval = time::interval(Duration::from_secs(FLUSH_INTERVAL_SECS));
    let batch_notify = wal.batch_notify();

    loop {
        // Kafka-style: flush on whichever fires first — timer OR batch threshold
        let trigger = tokio::select! {
            _ = interval.tick() => "timer",
            _ = batch_notify.notified() => "batch_full",
        };

        debug!("Forwarder flush triggered by: {}", trigger);

        // --- Metrics ---
        let mut metrics = Vec::new();
        let mut metric_keys = Vec::new();
        {
            let tree = wal.metrics_tree();
            for item in tree.iter().take(BATCH_SIZE) {
                if let Ok((k, v)) = item {
                    if let Ok(payload) = rmp_serde::from_slice::<MetricPayload>(&v) {
                        metrics.push(payload);
                        metric_keys.push(k);
                    }
                }
            }
        }

        if !metrics.is_empty() {
            let count = metric_keys.len();
            let req = SyncMetricsRequest { payloads: metrics.clone() };
            match metrics_client.sync_metrics(req).await {
                Ok(resp) => {
                    let inner = resp.into_inner();
                    if inner.success {
                        info!("Forwarded {} metrics ({})", count, trigger);
                        let tree = wal.metrics_tree();
                        for k in metric_keys {
                            let _ = tree.remove(k);
                        }
                    } else {
                        error!("Metrics rejected by master: {}", inner.message);
                    }
                }
                Err(e) => error!("Metrics forward connection error: {:?}", e),
            }
        }

        // --- Logs ---
        let mut logs = Vec::new();
        let mut log_keys = Vec::new();
        {
            let tree = wal.logs_tree();
            for item in tree.iter().take(BATCH_SIZE) {
                if let Ok((k, v)) = item {
                    if let Ok(payload) = rmp_serde::from_slice::<LogEntry>(&v) {
                        logs.push(payload);
                        log_keys.push(k);
                    }
                }
            }
        }

        if !logs.is_empty() {
            let count = log_keys.len();
            let req = SyncLogsRequest { entries: logs.clone() };
            match logs_client.sync_logs(req).await {
                Ok(resp) => {
                    let inner = resp.into_inner();
                    if inner.success {
                        info!("Forwarded {} logs ({})", count, trigger);
                        let tree = wal.logs_tree();
                        for k in log_keys {
                            let _ = tree.remove(k);
                        }
                    } else {
                        error!("Logs rejected by master: {}", inner.message);
                    }
                }
                Err(e) => error!("Logs forward connection error: {:?}", e),
            }
        }

        // --- Traces & Profiles ---
        let mut traces = Vec::new();
        let mut trace_keys = Vec::new();
        {
            let tree = wal.traces_tree();
            for item in tree.iter().take(BATCH_SIZE) {
                if let Ok((k, v)) = item {
                    if let Ok(payload) = rmp_serde::from_slice::<Span>(&v) {
                        traces.push(payload);
                        trace_keys.push(k);
                    }
                }
            }
        }

        let mut profiles = Vec::new();
        let mut profile_keys = Vec::new();
        {
            let tree = wal.profiles_tree();
            for item in tree.iter().take(BATCH_SIZE) {
                if let Ok((k, v)) = item {
                    if let Ok(payload) = rmp_serde::from_slice::<shared_proto::traces::Profile>(&v) {
                        profiles.push(payload);
                        profile_keys.push(k);
                    }
                }
            }
        }

        if !traces.is_empty() || !profiles.is_empty() {
            let t_count = trace_keys.len();
            let p_count = profile_keys.len();
            let req = SyncTracesRequest { spans: traces.clone(), profiles: profiles.clone() };
            match traces_client.sync_traces(req).await {
                Ok(resp) => {
                    let inner = resp.into_inner();
                    if inner.success {
                        info!("Forwarded {} traces and {} profiles ({})", t_count, p_count, trigger);
                        let tree = wal.traces_tree();
                        for k in trace_keys {
                            let _ = tree.remove(k);
                        }
                        let p_tree = wal.profiles_tree();
                        for k in profile_keys {
                            let _ = p_tree.remove(k);
                        }
                    } else {
                        error!("Traces/Profiles rejected by master: {}", inner.message);
                    }
                }
                Err(e) => error!("Traces/Profiles forward connection error: {:?}", e),
            }
        }
    }
}
