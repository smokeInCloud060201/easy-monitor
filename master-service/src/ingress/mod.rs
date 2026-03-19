use std::net::SocketAddr;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

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

use crate::bus::{Event, EventBusTx};

#[derive(Clone)]
pub struct GrpcIngress {
    tx: EventBusTx,
}

impl GrpcIngress {
    pub fn new(tx: EventBusTx) -> Self {
        Self { tx }
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
        let entries = req.entries;
        
        info!("Received {} logs", entries.len());
        let _ = self.tx.send(Event::Logs(entries));

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
        let spans = req.spans;
        
        info!("Received {} spans", spans.len());
        let _ = self.tx.send(Event::Traces(spans));

        Ok(Response::new(SyncTracesResponse {
            success: true,
            message: "Traces accepted".to_string(),
        }))
    }
}

pub async fn start_grpc_server(tx: EventBusTx) -> anyhow::Result<()> {
    let addr: SocketAddr = "0.0.0.0:50051".parse()?;
    info!("gRPC Ingress listening on {}", addr);

    let ingress = GrpcIngress::new(tx);

    Server::builder()
        .add_service(MetricsServiceServer::new(ingress.clone()))
        .add_service(LogsServiceServer::new(ingress.clone()))
        .add_service(TracesServiceServer::new(ingress))
        .serve(addr)
        .await?;

    Ok(())
}
