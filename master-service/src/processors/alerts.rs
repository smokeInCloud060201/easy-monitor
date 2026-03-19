use tracing::{info, warn};
use crate::bus::{EventBusTx, EventBusRx, Event};

pub async fn start_alerts_evaluator(tx: EventBusTx, mut rx: EventBusRx) -> anyhow::Result<()> {
    info!("Starting Alerts Evaluator...");

    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(Event::Metrics(metrics)) => {
                    for metric in metrics {
                        if metric.name == "system.cpu.usage" && metric.value > 95.0 {
                            let msg = format!("CRITICAL ALERT: CPU usage extremely high! Value: {}%", metric.value);
                            warn!("{}", msg);
                            let _ = tx.send(Event::Alerts("CPU Threshold Breached".to_string(), msg));
                        }
                    }
                }
                Ok(Event::Logs(logs)) => {
                    for log in logs {
                        if log.level.eq_ignore_ascii_case("ERROR") || log.level.eq_ignore_ascii_case("FATAL") {
                            let msg = format!("LOG ALERT: Discovered error log from service {}: {}", log.service, log.message);
                            warn!("{}", msg);
                            let _ = tx.send(Event::Alerts("Critical App Error Log".to_string(), msg));
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
