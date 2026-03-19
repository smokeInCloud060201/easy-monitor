use std::sync::Arc;
use std::time::Duration;
use tokio::time;
use tonic::transport::{Channel, ClientTlsConfig, Certificate, Identity};
use tracing::{info, error};

use shared_proto::metrics::{metrics_service_client::MetricsServiceClient, SyncMetricsRequest, MetricPayload};
use shared_proto::logs::{logs_service_client::LogsServiceClient, SyncLogsRequest, LogEntry};
use shared_proto::traces::{traces_service_client::TracesServiceClient, SyncTracesRequest, Span};

use crate::wal::WalBuffer;

pub async fn start_forwarder_worker(wal: Arc<WalBuffer>) -> anyhow::Result<()> {
    info!("Starting node-agent Forwarder Worker...");
    
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

    let mut interval = time::interval(Duration::from_secs(5));

    loop {
        interval.tick().await;

        // --- Metrics ---
        let mut metrics = Vec::new();
        let mut metric_keys = Vec::new();
        {
            let tree = wal.metrics_tree();
            for item in tree.iter().take(500) {
                if let Ok((k, v)) = item {
                    if let Ok(payload) = rmp_serde::from_slice::<MetricPayload>(&v) {
                        metrics.push(payload);
                        metric_keys.push(k);
                    }
                }
            }
        }

        if !metrics.is_empty() {
            let req = SyncMetricsRequest { payloads: metrics.clone() };
            match metrics_client.sync_metrics(req).await {
                Ok(resp) => {
                    let inner = resp.into_inner();
                    if inner.success {
                        info!("Successfully forwarded {} metrics", metric_keys.len());
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
            for item in tree.iter().take(500) {
                if let Ok((k, v)) = item {
                    if let Ok(payload) = rmp_serde::from_slice::<LogEntry>(&v) {
                        logs.push(payload);
                        log_keys.push(k);
                    }
                }
            }
        }

        if !logs.is_empty() {
            let req = SyncLogsRequest { entries: logs.clone() };
            match logs_client.sync_logs(req).await {
                Ok(resp) => {
                    let inner = resp.into_inner();
                    if inner.success {
                        info!("Successfully forwarded {} logs", log_keys.len());
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

        // --- Traces ---
        let mut traces = Vec::new();
        let mut trace_keys = Vec::new();
        {
            let tree = wal.traces_tree();
            for item in tree.iter().take(500) {
                if let Ok((k, v)) = item {
                    if let Ok(payload) = rmp_serde::from_slice::<Span>(&v) {
                        traces.push(payload);
                        trace_keys.push(k);
                    }
                }
            }
        }

        if !traces.is_empty() {
            let req = SyncTracesRequest { spans: traces.clone() };
            match traces_client.sync_traces(req).await {
                Ok(resp) => {
                    let inner = resp.into_inner();
                    if inner.success {
                        info!("Successfully forwarded {} spans", trace_keys.len());
                        let tree = wal.traces_tree();
                        for k in trace_keys {
                            let _ = tree.remove(k);
                        }
                    } else {
                        error!("Traces rejected by master: {}", inner.message);
                    }
                }
                Err(e) => error!("Traces forward connection error: {:?}", e),
            }
        }
    }
}
