use tracing::{info, warn};
use crate::bus::{EventBusRx, Event};

pub async fn start_alerts_evaluator(mut rx: EventBusRx) -> anyhow::Result<()> {
    info!("Starting Alerts Evaluator...");

    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(Event::Metrics(metrics)) => {
                    for metric in metrics {
                        if metric.name == "system.cpu.usage" && metric.value > 95.0 {
                            warn!("CRITICAL ALERT: CPU usage extremely high! Value: {}%", metric.value);
                        }
                    }
                }
                Ok(Event::Logs(logs)) => {
                    for log in logs {
                        if log.level.eq_ignore_ascii_case("ERROR") || log.level.eq_ignore_ascii_case("FATAL") {
                            warn!("LOG ALERT: Discovered error log from service {}: {}", log.service, log.message);
                        }
                    }
                }
                Ok(_) => {},
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                Err(_) => {},
            }
        }
    });

    Ok(())
}
