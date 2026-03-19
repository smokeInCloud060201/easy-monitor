use reqwest::Client;
use tracing::{info, error};
use serde_json::json;

use crate::bus::{EventBusRx, Event};

pub async fn start_notifications_engine(mut rx: EventBusRx) -> anyhow::Result<()> {
    info!("Starting Notifications Webhook Engine...");
    let client = Client::new();
    
    let webhook_url = std::env::var("WEBHOOK_URL").unwrap_or_else(|_| "https://httpbin.org/post".to_string());

    tokio::spawn(async move {
        loop {
            match rx.recv().await {
                Ok(Event::Alerts(title, description)) => {
                    info!("Dispatching Webhook for Alert: {}", title);
                    let payload = json!({
                        "text": format!("🚨 *{}*\n> {}", title, description)
                    });

                    let webhook = webhook_url.clone();
                    let cli = client.clone();
                    
                    tokio::spawn(async move {
                        if let Err(e) = cli.post(&webhook).json(&payload).send().await {
                            error!("Webhook dispatch failed: {}", e);
                        } else {
                            info!("Successfully Dispatched webhook Alert.");
                        }
                    });
                }
                Ok(_) => {}, 
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                Err(_) => {},
            }
        }
    });

    Ok(())
}
