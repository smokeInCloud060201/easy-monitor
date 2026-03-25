use std::net::SocketAddr;
use tonic::{transport::Server, Request, Response, Status};
use tracing::{info, warn};

use shared_proto::metrics::{
    metrics_service_server::{MetricsService, MetricsServiceServer},
    SyncMetricsRequest, SyncMetricsResponse,
};
use shared_proto::logs::{
    logs_service_server::{LogsService, LogsServiceServer},
    SyncLogsRequest, SyncLogsResponse,
};
use shared_proto::traces::{
    traces_service_server::{TracesService, TracesServiceServer},
    SyncTracesRequest, SyncTracesResponse,
};

use crate::bus::{Event, EventBusTx, WriteChannels};
use crate::utils::is_internal_service;

#[derive(Clone)]
pub struct GrpcIngress {
    write: WriteChannels, // mpsc senders for write-path (high-throughput, drop-oldest)
    tx: EventBusTx,       // broadcast for processors (fan-out)
}

impl GrpcIngress {
    pub fn new(write: WriteChannels, tx: EventBusTx) -> Self {
        Self { write, tx }
    }
}

#[tonic::async_trait]
impl MetricsService for GrpcIngress {
    async fn sync_metrics(
        &self,
        request: Request<SyncMetricsRequest>,
    ) -> Result<Response<SyncMetricsResponse>, Status> {
        let req = request.into_inner();
        let payloads = req.payloads;
        
        info!("Received {} metrics", payloads.len());

        // Write-path: send to mpsc (drop if full)
        if let Err(_) = self.write.metrics_tx.try_send(payloads.clone()) {
            warn!("Write-path: metrics channel full, dropping batch");
        }

        // Processor broadcast (best-effort)
        let _ = self.tx.send(Event::Metrics(payloads));

        Ok(Response::new(SyncMetricsResponse {
            success: true,
            message: "Metrics accepted".to_string(),
        }))
    }
}

#[tonic::async_trait]
impl LogsService for GrpcIngress {
    async fn sync_logs(
        &self,
        request: Request<SyncLogsRequest>,
    ) -> Result<Response<SyncLogsResponse>, Status> {
        let req = request.into_inner();
        let entries: Vec<_> = req.entries.into_iter()
            .filter(|e| !is_internal_service(&e.service))
            .collect();
        
        if !entries.is_empty() {
            info!("Received {} logs", entries.len());

            // Write-path: send to mpsc (drop if full)
            if let Err(_) = self.write.logs_tx.try_send(entries.clone()) {
                warn!("Write-path: logs channel full, dropping batch");
            }

            // Processor broadcast (best-effort)
            let _ = self.tx.send(Event::Logs(entries));
        }

        Ok(Response::new(SyncLogsResponse {
            success: true,
            message: "Logs accepted".to_string(),
        }))
    }
}

#[tonic::async_trait]
impl TracesService for GrpcIngress {
    async fn sync_traces(
        &self,
        request: Request<SyncTracesRequest>,
    ) -> Result<Response<SyncTracesResponse>, Status> {
        let req = request.into_inner();
        let spans: Vec<_> = req.spans.into_iter()
            .filter(|s| !is_internal_service(&s.service))
            .collect();
        
        if !spans.is_empty() {
            info!("Received {} spans", spans.len());

            // Write-path: send to mpsc (drop if full)
            if let Err(_) = self.write.traces_tx.try_send(spans.clone()) {
                warn!("Write-path: traces channel full, dropping batch");
            }

            // Processor broadcast (best-effort)
            let _ = self.tx.send(Event::Traces(spans));
        }

        Ok(Response::new(SyncTracesResponse {
            success: true,
            message: "Traces accepted".to_string(),
        }))
    }
}

use tonic::transport::{Identity, ServerTlsConfig, Certificate};

pub async fn start_grpc_server(write: WriteChannels, tx: EventBusTx) -> anyhow::Result<()> {
    let addr: SocketAddr = "127.0.0.1:50051".parse()?;
    info!("gRPC Ingress listening on {}", addr);

    let cert = std::fs::read_to_string("../certs/server.pem")?;
    let key = std::fs::read_to_string("../certs/server.key")?;
    let server_identity = Identity::from_pem(cert, key);

    let client_ca_cert = std::fs::read_to_string("../certs/ca.pem")?;
    let client_ca_cert = Certificate::from_pem(client_ca_cert);

    let tls = ServerTlsConfig::new()
        .identity(server_identity)
        .client_ca_root(client_ca_cert);

    let ingress = GrpcIngress::new(write, tx);

    Server::builder()
        .tls_config(tls)?
        .add_service(MetricsServiceServer::new(ingress.clone()).accept_compressed(tonic::codec::CompressionEncoding::Gzip))
        .add_service(LogsServiceServer::new(ingress.clone()).accept_compressed(tonic::codec::CompressionEncoding::Gzip))
        .add_service(TracesServiceServer::new(ingress).accept_compressed(tonic::codec::CompressionEncoding::Gzip))
        .serve(addr)
        .await?;

    Ok(())
}
