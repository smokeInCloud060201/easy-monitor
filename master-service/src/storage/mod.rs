use std::path::Path;
use tantivy::{schema::*, Index, IndexWriter, doc};
use tokio::task;
use tracing::{info, error};
use crate::bus::{EventBusRx, Event};

pub async fn start_storage_writer(mut rx: EventBusRx) -> anyhow::Result<()> {
    info!("Starting Tantivy Storage Writer...");

    let mut schema_builder = Schema::builder();
    let id_field = schema_builder.add_text_field("id", STRING | FAST | STORED);
    let r#type = schema_builder.add_text_field("type", STRING | FAST | STORED);
    let service_field = schema_builder.add_text_field("service", TEXT | FAST | STORED);
    let message_field = schema_builder.add_text_field("message", TEXT | STORED);
    let schema = schema_builder.build();

    let index_path = Path::new("/tmp/easy-monitor/master-index");
    std::fs::create_dir_all(index_path)?;
    
    let index = Index::create_in_dir(&index_path, schema.clone())
        .or_else(|_| Index::open_in_dir(&index_path))?;

    task::spawn_blocking(move || {
        let mut index_writer: IndexWriter = match index.writer(50_000_000) {
            Ok(w) => w,
            Err(e) => {
                error!("Failed to create Tantivy writer: {}", e);
                return;
            }
        };

        loop {
            match rx.blocking_recv() {
                Ok(Event::Logs(logs)) => {
                    for log in logs {
                        if let Err(e) = index_writer.add_document(doc!(
                            id_field => log.trace_id.clone(),
                            r#type => "log",
                            service_field => log.service.clone(),
                            message_field => log.message.clone()
                        )) {
                            error!("Tantivy write error: {}", e);
                        }
                    }
                    let _ = index_writer.commit();
                }
                Ok(Event::Traces(spans)) => {
                    for span in spans {
                        if let Err(e) = index_writer.add_document(doc!(
                            id_field => span.trace_id.clone(),
                            r#type => "span",
                            service_field => span.service.clone(),
                            message_field => span.name.clone()
                        )) {
                            error!("Tantivy write error: {}", e);
                        }
                    }
                    let _ = index_writer.commit();
                }
                Ok(Event::Metrics(_)) => {}
                Err(tokio::sync::broadcast::error::RecvError::Lagged(missed)) => {
                    error!("Storage writer lagged by {} events", missed);
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    break;
                }
            }
        }
    });

    Ok(())
}
