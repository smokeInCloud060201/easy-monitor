use tokio::sync::broadcast;

use shared_proto::metrics::MetricPayload;
use shared_proto::logs::LogEntry;
use shared_proto::traces::Span;

#[derive(Clone, Debug)]
pub enum Event {
    Metrics(Vec<MetricPayload>),
    Logs(Vec<LogEntry>),
    Traces(Vec<Span>),
    Alerts(String, String),
}

pub type EventBusTx = broadcast::Sender<Event>;
pub type EventBusRx = broadcast::Receiver<Event>;

pub fn init_event_bus() -> (EventBusTx, EventBusRx) {
    // Capacity for 1024 events in the channel
    broadcast::channel(1024)
}
