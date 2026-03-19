use std::sync::Arc;
use std::net::SocketAddr;
use tonic::{transport::Server, Request, Response, Status};
use tracing::info;

use shared_proto::traces::{
    traces_service_server::{TracesService, TracesServiceServer},
    SyncTracesRequest, SyncTracesResponse,
};
use crate::wal::WalBuffer;

pub struct OTLPReceiver {
    wal: Arc<WalBuffer>,
}

#[tonic::async_trait]
impl TracesService for OTLPReceiver {
    async fn sync_traces(
        &self,
        request: Request<SyncTracesRequest>,
    ) -> Result<Response<SyncTracesResponse>, Status> {
        let spans = request.into_inner().spans;
        for span in spans {
            if let Err(e) = self.wal.write_trace(span).await {
                tracing::error!("Failed to write APM span to WAL: {}", e);
            }
        }
        Ok(Response::new(SyncTracesResponse {
            success: true,
            message: "Spans accepted by Node Agent".to_string(),
        }))
    }
}

pub async fn start_apm_receiver(wal: Arc<WalBuffer>) -> anyhow::Result<()> {
    let addr: SocketAddr = "0.0.0.0:4317".parse()?;
    info!("APM/OTLP Receiver listening on {}", addr);

    let svc = OTLPReceiver { wal };

    Server::builder()
        .add_service(TracesServiceServer::new(svc))
        .serve(addr)
        .await?;

    Ok(())
}
