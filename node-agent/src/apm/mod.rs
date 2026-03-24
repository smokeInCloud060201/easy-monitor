use std::sync::Arc;
use std::net::SocketAddr;
use tonic::{transport::Server, Request, Response, Status};
use tracing::{info, error};

use shared_proto::opentelemetry::proto::collector::trace::v1::{
    trace_service_server::{TraceService, TraceServiceServer},
    ExportTraceServiceRequest, ExportTraceServiceResponse,
};
use shared_proto::opentelemetry::proto::collector::metrics::v1::{
    metrics_service_server::{MetricsService, MetricsServiceServer},
    ExportMetricsServiceRequest, ExportMetricsServiceResponse,
};
use shared_proto::opentelemetry::proto::collector::logs::v1::{
    logs_service_server::{LogsService, LogsServiceServer},
    ExportLogsServiceRequest, ExportLogsServiceResponse,
};

use crate::wal::WalBuffer;

#[derive(Clone)]
pub struct OTLPReceiver {
    wal: Arc<WalBuffer>,
}

#[tonic::async_trait]
impl TraceService for OTLPReceiver {
    async fn export(
        &self,
        request: Request<ExportTraceServiceRequest>,
    ) -> Result<Response<ExportTraceServiceResponse>, Status> {
        let req = request.into_inner();
        
        for resource_span in req.resource_spans {
            let service_name = extract_service_name(&resource_span.resource);
            
            for scope_span in resource_span.scope_spans {
                for span in scope_span.spans {
                    let trace_id = hex::encode(&span.trace_id);
                    let span_id = hex::encode(&span.span_id);
                    let parent_span_id = if span.parent_span_id.is_empty() {
                        "".to_string()
                    } else {
                        hex::encode(&span.parent_span_id)
                    };
                    
                    let duration_ms = if span.end_time_unix_nano > span.start_time_unix_nano {
                        (span.end_time_unix_nano - span.start_time_unix_nano) / 1_000_000
                    } else {
                        0
                    } as u64;

                    let mut tags = std::collections::HashMap::new();
                    for attr in span.attributes {
                        if let Some(val) = &attr.value {
                            let val_str = extract_any_value(val);
                            tags.insert(attr.key.clone(), val_str);
                        }
                    }

                    let mut derived_name = span.name.clone();
                    let method = tags.get("http.method").or(tags.get("http.request.method")).cloned();
                    let mut route = tags.get("http.route").or(tags.get("url.path")).or(tags.get("http.target")).cloned();

                    if route.is_none() {
                        if let Some(url) = tags.get("url.full").or(tags.get("http.url")) {
                            if let Some(idx) = url.find("://") {
                                let without_scheme = &url[idx+3..];
                                if let Some(slash_idx) = without_scheme.find('/') {
                                    route = Some(without_scheme[slash_idx..].to_string());
                                } else {
                                    route = Some("/".to_string());
                                }
                            } else if url.starts_with('/') {
                                route = Some(url.clone());
                            }
                        }
                    }

                    if route.is_none() {
                        if let Some(m) = &method {
                            if span.name.starts_with(m) {
                                let possible_route = span.name[m.len()..].trim();
                                if !possible_route.is_empty() {
                                    route = Some(possible_route.to_string());
                                }
                            }
                        }
                    }

                    let db_system = tags.get("db.system");
                    let db_operation = tags.get("db.operation");
                    let db_statement = tags.get("db.statement");
                    let rpc_system = tags.get("rpc.system");
                    let rpc_method = tags.get("rpc.method");

                    if let Some(m) = method {
                        let r = route.unwrap_or_else(|| "".to_string());
                        let path_suffix = if r.is_empty() { "".to_string() } else { format!(" {}", r) };
                        if span.kind == 2 {
                            let prefix = if service_name.contains("node") || service_name.contains("payment") {
                                "express.request"
                            } else if service_name.contains("go") || service_name.contains("category") {
                                "http.server.request"
                            } else if service_name.contains("java") || service_name.contains("checkout") {
                                "servlet.request"
                            } else if service_name.contains("rust") || service_name.contains("notification") {
                                "actix.request"
                            } else {
                                "http.server.request"
                            };
                            derived_name = format!("{} · {}{}", prefix, m, path_suffix);
                        } else if span.kind == 3 {
                            derived_name = format!("http.client · {}{}", m, path_suffix);
                        } else {
                            derived_name = format!("http · {}{}", m, path_suffix);
                        }
                    } else if let Some(sys) = db_system {
                        let query_desc = if let Some(stmt) = db_statement {
                            stmt.clone()
                        } else if let Some(op) = db_operation {
                            op.clone()
                        } else {
                            "".to_string()
                        };
                        
                        let safe_desc = if query_desc.len() > 1000 {
                            format!("{}...", &query_desc[0..1000])
                        } else {
                            query_desc
                        };

                        if safe_desc.is_empty() {
                            derived_name = format!("{}.query", sys);
                        } else {
                            derived_name = format!("{}.query · {}", sys, safe_desc);
                        }
                    } else if let (Some(sys), Some(meth)) = (rpc_system, rpc_method) {
                        derived_name = format!("{}.request · {}", sys, meth);
                    }

                    // Map generic status cleanly
                    let error_status = if let Some(status) = &span.status {
                        status.code == 2 // 2 corresponds to STATUS_CODE_ERROR in OTLP
                    } else {
                        false
                    };

                    let my_span = shared_proto::traces::Span {
                        trace_id,
                        span_id,
                        parent_id: parent_span_id,
                        name: derived_name.clone(),
                        service: service_name.clone(),
                        resource: derived_name,
                        start_time: (span.start_time_unix_nano / 1_000_000) as i64,
                        duration: duration_ms as i64,
                        meta: tags,
                        error: if error_status { 1 } else { 0 },
                        metrics: std::collections::HashMap::new(),
                    };

                    if let Err(e) = self.wal.write_trace(my_span).await {
                        error!("Failed to write translated OTLP trace to WAL: {}", e);
                    }
                }
            }
        }

        Ok(Response::new(ExportTraceServiceResponse {
            partial_success: None,
        }))
    }
}

#[tonic::async_trait]
impl MetricsService for OTLPReceiver {
    async fn export(
        &self,
        request: Request<ExportMetricsServiceRequest>,
    ) -> Result<Response<ExportMetricsServiceResponse>, Status> {
        let req = request.into_inner();
        
        for resource_metric in req.resource_metrics {
            let service_name = extract_service_name(&resource_metric.resource);
            
            for scope_metric in resource_metric.scope_metrics {
                for metric in scope_metric.metrics {
                    let name = metric.name.clone();
                    
                    // Natively handle basic Gauge and Sum metrics safely decoupling unhandled points
                    if let Some(data) = metric.data {
                        match data {
                            shared_proto::opentelemetry::proto::metrics::v1::metric::Data::Gauge(gauge) => {
                                for dp in gauge.data_points {
                                    let mut tags = std::collections::HashMap::new();
                                    tags.insert("service".to_string(), service_name.clone());
                                    // Extract embedded attributes
                                    for attr in dp.attributes {
                                        if let Some(val) = &attr.value {
                                            tags.insert(attr.key.clone(), extract_any_value(val));
                                        }
                                    }
                                    
                                    let value = if dp.value.is_some() {
                                        match dp.value.unwrap() {
                                            shared_proto::opentelemetry::proto::metrics::v1::number_data_point::Value::AsDouble(d) => d,
                                            shared_proto::opentelemetry::proto::metrics::v1::number_data_point::Value::AsInt(i) => i as f64,
                                        }
                                    } else { 0.0 };

                                    let mp = shared_proto::metrics::MetricPayload {
                                        name: name.clone(),
                                        value,
                                        r#type: "gauge".to_string(),
                                        timestamp: (dp.time_unix_nano / 1_000_000) as i64,
                                        tags,
                                    };
                                    let _ = self.wal.write_metric(mp).await;
                                }
                            },
                            shared_proto::opentelemetry::proto::metrics::v1::metric::Data::Sum(sum) => {
                                for dp in sum.data_points {
                                    let mut tags = std::collections::HashMap::new();
                                    tags.insert("service".to_string(), service_name.clone());
                                    for attr in dp.attributes {
                                        if let Some(val) = &attr.value {
                                            tags.insert(attr.key.clone(), extract_any_value(val));
                                        }
                                    }
                                    
                                    let value = if dp.value.is_some() {
                                        match dp.value.unwrap() {
                                            shared_proto::opentelemetry::proto::metrics::v1::number_data_point::Value::AsDouble(d) => d,
                                            shared_proto::opentelemetry::proto::metrics::v1::number_data_point::Value::AsInt(i) => i as f64,
                                        }
                                    } else { 0.0 };

                                    let mp = shared_proto::metrics::MetricPayload {
                                        name: name.clone(),
                                        value,
                                        r#type: "count".to_string(),
                                        timestamp: (dp.time_unix_nano / 1_000_000) as i64,
                                        tags,
                                    };
                                    let _ = self.wal.write_metric(mp).await;
                                }
                            },
                            _ => {} // Skip Histograms cleanly natively 
                        }
                    }
                }
            }
        }

        Ok(Response::new(ExportMetricsServiceResponse {
            partial_success: None,
        }))
    }
}

#[tonic::async_trait]
impl LogsService for OTLPReceiver {
    async fn export(
        &self,
        request: Request<ExportLogsServiceRequest>,
    ) -> Result<Response<ExportLogsServiceResponse>, Status> {
        let req = request.into_inner();
        
        for resource_log in req.resource_logs {
            let service_name = extract_service_name(&resource_log.resource);
            
            for scope_log in resource_log.scope_logs {
                for log_record in scope_log.log_records {
                    
                    let message = if let Some(body) = log_record.body {
                        extract_any_value(&body)
                    } else {
                        "".to_string()
                    };
                    
                    let level = if log_record.severity_text.is_empty() {
                        "INFO".to_string()
                    } else {
                        log_record.severity_text.clone()
                    };

                    let trace_id = if log_record.trace_id.is_empty() {
                        uuid::Uuid::new_v4().to_string()
                    } else {
                        hex::encode(&log_record.trace_id)
                    };
                    
                    let mut tags = std::collections::HashMap::new();
                    for attr in log_record.attributes {
                        if let Some(val) = &attr.value {
                            tags.insert(attr.key.clone(), extract_any_value(val));
                        }
                    }

                    let mut timestamp_ms = (log_record.time_unix_nano / 1_000_000) as i64;
                    if timestamp_ms == 0 {
                        timestamp_ms = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as i64;
                    }

                    let my_log = shared_proto::logs::LogEntry {
                        service: service_name.clone(),
                        level,
                        message,
                        tags,
                        trace_id,
                        timestamp: timestamp_ms,
                    };

                    if let Err(e) = self.wal.write_log(my_log).await {
                        error!("Failed to write translated OTLP log to WAL: {}", e);
                    }
                }
            }
        }

        Ok(Response::new(ExportLogsServiceResponse {
            partial_success: None,
        }))
    }
}

// Helper to pull standard service names organically natively decoupled bounds
fn extract_service_name(resource: &Option<shared_proto::opentelemetry::proto::resource::v1::Resource>) -> String {
    if let Some(res) = resource {
        for attr in &res.attributes {
            if attr.key == "service.name" {
                if let Some(val) = &attr.value {
                    return extract_any_value(val);
                }
            }
        }
    }
    "unknown-service".to_string()
}

// Helper to dynamically convert OTLP AnyValue structs accurately securely into strings natively
fn extract_any_value(val: &shared_proto::opentelemetry::proto::common::v1::AnyValue) -> String {
    if let Some(v) = &val.value {
        match v {
            shared_proto::opentelemetry::proto::common::v1::any_value::Value::StringValue(s) => s.clone(),
            shared_proto::opentelemetry::proto::common::v1::any_value::Value::BoolValue(b) => b.to_string(),
            shared_proto::opentelemetry::proto::common::v1::any_value::Value::IntValue(i) => i.to_string(),
            shared_proto::opentelemetry::proto::common::v1::any_value::Value::DoubleValue(d) => d.to_string(),
            _ => "complex_value".to_string(),
        }
    } else {
        "".to_string()
    }
}

pub async fn start_apm_receiver(wal: Arc<WalBuffer>) -> anyhow::Result<()> {
    let addr: SocketAddr = "0.0.0.0:4317".parse()?;
    info!("Universal OTLP Receiver natively bounding tightly mapping standard bounds on {}", addr);

    let svc = OTLPReceiver { wal };

    Server::builder()
        .add_service(TraceServiceServer::new(svc.clone()))
        .add_service(MetricsServiceServer::new(svc.clone()))
        .add_service(LogsServiceServer::new(svc))
        .serve(addr)
        .await?;

    Ok(())
}
