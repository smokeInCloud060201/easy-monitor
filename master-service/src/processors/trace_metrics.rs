use std::sync::Arc;
use dashmap::DashMap;
use tokio::time::{self, Duration};
use tracing::{info, error};

use shared_proto::metrics::MetricPayload;
use crate::bus::{EventBusTx, EventBusRx, Event};

pub async fn start_trace_metrics_engine(tx: EventBusTx, mut rx: EventBusRx) -> anyhow::Result<()> {
    info!("Starting Trace-to-Metrics Engine (RED)...");

    let aggregate: Arc<DashMap<String, f64>> = Arc::new(DashMap::new());

    let agg_clone = aggregate.clone();
    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(Event::Traces(spans)) => {
                    for span in spans {
                        let base_key = format!("{}:{}", span.service, span.resource);
                        
                        *agg_clone.entry(format!("{}:rate", base_key)).or_insert(0.0) += 1.0;
                        
                        if span.error > 0 {
                            *agg_clone.entry(format!("{}:error", base_key)).or_insert(0.0) += 1.0;
                        }

                        *agg_clone.entry(format!("{}:duration_sum", base_key)).or_insert(0.0) += span.duration as f64;
                    }
                }
                Ok(_) => {}, 
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                Err(_) => continue,
            }
        }
    });

    let mut interval = time::interval(Duration::from_secs(10));
    tokio::spawn(async move {
        loop {
            interval.tick().await;
            
            let mut payloads = Vec::new();
            let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;

            for entry in aggregate.iter() {
                let tags = std::collections::HashMap::new();
                payloads.push(MetricPayload {
                    name: format!("apm.{}", entry.key()),
                    value: *entry.value(),
                    r#type: "rate".to_string(),
                    tags,
                    timestamp: ts,
                });
            }

            aggregate.clear();

            if !payloads.is_empty() {
                info!("TraceEngine generated {} RED metrics asynchronously", payloads.len());
                if let Err(e) = tx.send(Event::Metrics(payloads)) {
                    error!("TraceEngine failed to dispatch RED metrics: {}", e);
                }
            }
        }
    });

    Ok(())
}
